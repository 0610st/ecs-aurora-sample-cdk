import { Environment } from 'aws-cdk-lib';
import { Node } from 'constructs';

export type EnvType = 'test' | 'dev' | 'stage' | 'prod' | 'common';

interface ContextValueProps {
  vpcId: string;
  subnetIds: string[];
  routeTableId: string;
  env?: Environment;
}

export class Context {
  public readonly envType: EnvType;
  public readonly systemName: string;
  public readonly vpcId: string;
  public readonly subnetIds: string[];
  public readonly routeTableId: string;
  public readonly env?: Environment;

  constructor(envType: EnvType, systemName: string, node: Node) {
    this.envType = envType;
    this.systemName = systemName;
    const contextValue = node.tryGetContext(`${this.envType}`) as ContextValueProps;
    this.vpcId = contextValue.vpcId;
    this.subnetIds = contextValue.subnetIds;
    this.routeTableId = contextValue.routeTableId;
    this.env = contextValue.env;
  }

  isDevelopment() {
    return this.envType === 'dev';
  }
}
