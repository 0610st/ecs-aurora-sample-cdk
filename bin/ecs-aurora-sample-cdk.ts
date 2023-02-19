#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { Context, EnvType } from '../lib/context';
import { CicdStack } from '../lib/stack/cicd-stack';
import { CommonNetworkStack } from '../lib/stack/common/common-network-stack';
import { CommonStatefulStack } from '../lib/stack/common/common-stateful-stack';
import { EcsStack } from '../lib/stack/ecs-stack';
import { StatefulStack } from '../lib/stack/stateful-stack';

const app = new cdk.App();
const envType = app.node.tryGetContext('envType') as EnvType;
const systemName = app.node.tryGetContext('systemName') as string;
const context = new Context(envType, systemName, app.node);
const env = context.env ?? {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

const commonStatefulStack = new CommonStatefulStack(app, 'StatefulStack', {
  context,
  env,
  terminationProtection: true,
});

const commonNetworkStack = new CommonNetworkStack(app, 'NetworkStack', { context, env });

const statefulStackDeps = {
  databaseVpc: commonNetworkStack.vpc,
  databaseSubnets: [commonNetworkStack.subnets.private1, commonNetworkStack.subnets.private2],
};
const statefulStack = new StatefulStack(app, 'StatefulStack', statefulStackDeps, {
  context,
  env,
  terminationProtection: true,
});

const ecsStackDeps = {
  ecrRepository: statefulStack.ecrRepository,
  vpc: commonNetworkStack.vpc,
  targetSubnets: [commonNetworkStack.subnets.private1, commonNetworkStack.subnets.private2],
  targetSecurityGroup: commonNetworkStack.securityGroups.web,
  loadBalancerSecurityGroup: commonNetworkStack.securityGroups.alb,
};
const ecsStack = new EcsStack(app, 'EcsStack', ecsStackDeps, { context, env });

const cicdStackDeps = {
  codeRepository: commonStatefulStack.codeRepository,
  ecrRepository: statefulStack.ecrRepository,
  fargateService: ecsStack.fargateService,
};
new CicdStack(app, 'CicdStack', cicdStackDeps, { context, env });
