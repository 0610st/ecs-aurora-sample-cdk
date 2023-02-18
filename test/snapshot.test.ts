import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { Context, EnvType } from '../lib/context';
import { CicdStack } from '../lib/stack/cicd-stack';
import { CommonNetworkStack } from '../lib/stack/common/common-network-stack';
import { CommonStatefulStack } from '../lib/stack/common/common-stateful-stack';
import { EcsStack } from '../lib/stack/ecs-stack';
import { StatefulStack } from '../lib/stack/stateful-stack';

test('snapthot test', () => {
  const app = new cdk.App({
    context: {
      systemName: 'myCdk',
      envType: 'test',
      test: {
        vpcId: 'vpc-dummy',
        subnetIds: ['subnet-dummy1', 'subnet-dummy2'],
        routeTableId: 'rtb-dummy',
        env: {
          account: 'dummy-account',
          region: 'dummy-region',
        },
      },
    },
  });
  const envType = app.node.tryGetContext('envType') as EnvType;
  const systemName = app.node.tryGetContext('systemName') as string;
  const context = new Context(envType, systemName, app.node);
  const env = context.env ?? {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  };

  const commonStatefulStack = new CommonStatefulStack(app, 'StatefulStack', { context, env });

  const commonNetworkStack = new CommonNetworkStack(app, 'NetworkStack', { context, env });

  const statefulStackDeps = {
    databaseVpc: commonNetworkStack.vpc,
    databaseSubnets: [commonNetworkStack.subnets.private1, commonNetworkStack.subnets.private2],
  };
  const statefulStack = new StatefulStack(app, 'StatefulStack', statefulStackDeps, { context, env });

  const ecsStackDeps = {
    ecrRepository: statefulStack.ecrRepository,
    vpc: commonNetworkStack.vpc,
    targetSubnets: [commonNetworkStack.subnets.private1, commonNetworkStack.subnets.private2],
    vpcEndpointSecurityGroup: commonNetworkStack.securityGroups.endpoint,
  };
  const ecsStack = new EcsStack(app, 'EcsStack', ecsStackDeps, { context, env });

  const cicdStackDeps = {
    codeRepository: commonStatefulStack.codeRepository,
    ecrRepository: statefulStack.ecrRepository,
    fargateService: ecsStack.fargateService,
  };
  const cicdStack = new CicdStack(app, 'CicdStack', cicdStackDeps, { context, env });

  expect(Template.fromStack(commonStatefulStack)).toMatchSnapshot();
  expect(Template.fromStack(commonNetworkStack)).toMatchSnapshot();
  expect(Template.fromStack(statefulStack)).toMatchSnapshot();
  expect(Template.fromStack(ecsStack)).toMatchSnapshot();
  expect(Template.fromStack(cicdStack)).toMatchSnapshot();
});
