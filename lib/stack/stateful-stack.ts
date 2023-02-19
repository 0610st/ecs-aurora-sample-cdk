import { RemovalPolicy } from 'aws-cdk-lib';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import { Construct } from 'constructs';
import { createResourceName } from '../util';
import { RetentionDays } from 'aws-cdk-lib/aws-logs';
import { BaseStack, BaseStackProps } from '../abstract/BaseStack';

export interface StatefulStackDependencyProps {
  databaseVpc: ec2.IVpc;
  databaseSubnets: ec2.ISubnet[];
}

export class StatefulStack extends BaseStack {
  public readonly ecrRepository: ecr.Repository;
  public readonly dbCluster: rds.DatabaseCluster;

  constructor(scope: Construct, id: string, deps: StatefulStackDependencyProps, props: BaseStackProps) {
    super(scope, id, props);

    this.ecrRepository = this.createEcrRepository(this, props);

    this.dbCluster = this.createAurora(this, deps.databaseVpc, deps.databaseSubnets);

    this.createStopDbFunction(this, this.dbCluster.clusterIdentifier);
  }

  private createEcrRepository(scope: Construct, props: BaseStackProps): ecr.Repository {
    return new ecr.Repository(scope, 'EcrRepository', {
      repositoryName: createResourceName(props.context.systemName, props.context.envType, 'backend-repo').toLowerCase(),
      encryption: ecr.RepositoryEncryption.KMS,
      lifecycleRules: [{ maxImageCount: 2 }],
    });
  }

  private createAurora(scope: Construct, vpc: ec2.IVpc, subnets: ec2.ISubnet[]): rds.DatabaseCluster {
    const dbSecurityGroup = new ec2.SecurityGroup(scope, 'SecurityGroupDb', {
      vpc: vpc,
    });

    const subnetGroup = new rds.SubnetGroup(scope, 'SubnetGroup', {
      description: 'db subnet group',
      vpc,
      vpcSubnets: {
        subnets,
      },
    });

    return new rds.DatabaseCluster(scope, 'DbCluster', {
      engine: rds.DatabaseClusterEngine.auroraPostgres({
        version: rds.AuroraPostgresEngineVersion.VER_14_3,
      }),
      instances: 1,
      instanceProps: {
        vpc: vpc,
        instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MEDIUM),
        securityGroups: [dbSecurityGroup],
      },
      subnetGroup,
      cloudwatchLogsExports: ['postgresql'],
      cloudwatchLogsRetention: RetentionDays.ONE_WEEK,
      removalPolicy: RemovalPolicy.RETAIN,
      storageEncrypted: true,
    });
  }

  private createStopDbFunction(scope: Construct, clusterIdentifier: string) {
    const stopDbFunction = new lambda.Function(scope, 'FunctionStopDb', {
      code: lambda.Code.fromAsset(`${__dirname}/../../stop_db_function`),
      runtime: lambda.Runtime.PYTHON_3_9,
      handler: 'app.lambda_handler',
      environment: {
        DB_CLUSTER_IDENTIFIER: clusterIdentifier,
      },
      logRetention: RetentionDays.ONE_WEEK,
    });

    stopDbFunction.addToRolePolicy(
      new iam.PolicyStatement({
        resources: ['*'],
        actions: ['rds:StopDBCluster'],
      }),
    );

    new events.Rule(scope, 'RuleForFunctionStopDb', {
      schedule: events.Schedule.cron({ minute: '0', hour: '16' }),
      targets: [new targets.LambdaFunction(stopDbFunction)],
    });
  }
}
