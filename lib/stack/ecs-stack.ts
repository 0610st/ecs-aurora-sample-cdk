import { Construct } from 'constructs';
import * as elb from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import { createResourceName } from '../util';
import { BaseStack, BaseStackProps } from '../abstract/BaseStack';

export interface EcsStackDependencyProps {
  ecrRepository: ecr.Repository;
  vpc: ec2.IVpc;
  targetSubnets: ec2.ISubnet[];
  vpcEndpointSecurityGroup: ec2.SecurityGroup;
}

export class EcsStack extends BaseStack {
  public readonly fargateService: ecs.FargateService;

  constructor(scope: Construct, id: string, deps: EcsStackDependencyProps, props: BaseStackProps) {
    super(scope, id, props);

    // Security Group
    const securityGroups = this.createSecurityGroups(this, deps.vpc);
    deps.vpcEndpointSecurityGroup.addIngressRule(
      ec2.Peer.securityGroupId(securityGroups.web.securityGroupId),
      ec2.Port.tcp(443),
    );

    // ALB
    const alb = this.createLoadBalancer(this, deps.vpc, securityGroups.alb, props);

    // ECS
    this.fargateService = this.createAutoScalingFargateService(
      this,
      deps.ecrRepository,
      alb,
      deps.vpc,
      deps.targetSubnets,
      securityGroups.web,
      props,
    );
  }

  private createSecurityGroups(scope: Construct, vpc: ec2.IVpc) {
    const alb = new ec2.SecurityGroup(scope, 'SecurityGroupAlb', {
      vpc: vpc,
    });
    alb.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80));

    const web = new ec2.SecurityGroup(scope, 'SecurityGroupWeb', {
      vpc: vpc,
    });

    return { alb, web };
  }

  private createLoadBalancer(
    scope: Construct,
    vpc: ec2.IVpc,
    securityGroup: ec2.SecurityGroup,
    props: BaseStackProps,
  ): elb.ApplicationLoadBalancer {
    const alb = new elb.ApplicationLoadBalancer(scope, 'Alb', {
      loadBalancerName: createResourceName(props.context.systemName, props.context.envType, 'alb'),
      vpc: vpc,
      internetFacing: true,
      securityGroup: securityGroup,
    });

    return alb;
  }

  private createAutoScalingFargateService(
    scope: Construct,
    repository: ecr.Repository,
    alb: elb.ApplicationLoadBalancer,
    vpc: ec2.IVpc,
    subnets: ec2.ISubnet[],
    securityGroup: ec2.SecurityGroup,
    props: BaseStackProps,
  ): ecs.FargateService {
    // Task Definition
    const taskDef = new ecs.TaskDefinition(scope, 'TaskDefinition', {
      compatibility: ecs.Compatibility.FARGATE,
      cpu: '512',
      memoryMiB: '1024',
    });

    taskDef.addContainer('web', {
      image: ecs.ContainerImage.fromEcrRepository(repository),
      memoryLimitMiB: 1024,
      portMappings: [
        {
          containerPort: 3000,
          hostPort: 3000,
          protocol: ecs.Protocol.TCP,
        },
      ],
    });

    // Cluster
    const cluster = new ecs.Cluster(scope, 'Cluster', {
      clusterName: createResourceName(props.context.systemName, props.context.envType, 'cluster'),
      vpc,
    });

    // Service
    const fargateService = new ecs.FargateService(scope, 'Service', {
      serviceName: createResourceName(props.context.systemName, props.context.envType, 'service'),
      cluster,
      taskDefinition: taskDef,
      securityGroups: [securityGroup],
      vpcSubnets: {
        subnets,
      },
    });

    const scale = fargateService.autoScaleTaskCount({
      minCapacity: 1,
      maxCapacity: 1,
    });

    scale.scaleOnCpuUtilization('CpuScaling', {
      targetUtilizationPercent: 60,
    });

    const albListener = alb.addListener('Listener', { port: 80 });
    fargateService.registerLoadBalancerTargets({
      containerName: 'web',
      containerPort: 3000,
      newTargetGroupId: 'ECS',
      listener: ecs.ListenerConfig.applicationListener(albListener, {
        protocol: elb.ApplicationProtocol.HTTP,
      }),
    });

    return fargateService;
  }
}
