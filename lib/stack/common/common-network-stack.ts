import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';
import { BaseStack, BaseStackProps } from '../../abstract/BaseStack';

export interface SubnetsProps {
  private1: ec2.ISubnet;
  private2: ec2.ISubnet;
}

export interface CommonSecurityGroupsProps {
  endpoint: ec2.SecurityGroup;
}

export class CommonNetworkStack extends BaseStack {
  public readonly vpc: ec2.IVpc;
  public readonly subnets: SubnetsProps;
  public readonly securityGroups: CommonSecurityGroupsProps;

  constructor(scope: Construct, id: string, props: BaseStackProps) {
    super(scope, id, props, true);

    // VPC(Lookup)
    this.vpc = this.findVpc(this, props.context.vpcId);

    // Subnet(Lookup)
    this.subnets = this.findSubnets(this, props.context.subnetIds, props.context.routeTableId);

    // Security Group
    this.securityGroups = this.createSecurityGroups(this, this.vpc);

    // VPC Endpoint
    this.createVpcEndpoints(
      this,
      this.vpc,
      [this.subnets.private1, this.subnets.private2],
      this.securityGroups.endpoint,
    );
  }

  private findVpc(scope: Construct, vpcId: string): ec2.IVpc {
    return ec2.Vpc.fromLookup(scope, 'Vpc', { vpcId });
  }

  private findSubnets(scope: Construct, subnetIds: string[], routeTableId?: string): SubnetsProps {
    return {
      private1: ec2.Subnet.fromSubnetAttributes(scope, 'SubnetPrivate1', {
        subnetId: subnetIds[0],
        routeTableId,
      }),
      private2: ec2.Subnet.fromSubnetAttributes(scope, 'SubnetPrivate2', {
        subnetId: subnetIds[1],
        routeTableId,
      }),
    };
  }

  private createSecurityGroups(scope: Construct, vpc: ec2.IVpc): CommonSecurityGroupsProps {
    const endpoint = new ec2.SecurityGroup(scope, 'SecurityGroupEndpoint', {
      vpc: vpc,
    });

    return { endpoint };
  }

  private createVpcEndpoints(
    scope: Construct,
    vpc: ec2.IVpc,
    subnets: ec2.ISubnet[],
    securityGroup: ec2.SecurityGroup,
  ) {
    new ec2.InterfaceVpcEndpoint(scope, 'EndpointEcr', {
      service: ec2.InterfaceVpcEndpointAwsService.ECR,
      vpc: vpc,
      securityGroups: [securityGroup],
      subnets: {
        subnets,
      },
    });

    new ec2.InterfaceVpcEndpoint(scope, 'EndpointEcrDkr', {
      service: ec2.InterfaceVpcEndpointAwsService.ECR_DOCKER,
      vpc: vpc,
      securityGroups: [securityGroup],
      subnets: {
        subnets,
      },
    });

    new ec2.GatewayVpcEndpoint(scope, 'EndpointS3', {
      service: ec2.GatewayVpcEndpointAwsService.S3,
      vpc: vpc,
      subnets: [
        {
          subnets,
        },
      ],
    });
  }
}
