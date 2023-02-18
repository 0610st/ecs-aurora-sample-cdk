import { Environment, Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Context } from '../context';

export interface BaseStackProps extends StackProps {
  context: Context;
  env?: Environment;
}

export class BaseStack extends Stack {
  constructor(scope: Construct, id: string, props: BaseStackProps, isCommon?: boolean) {
    const myId = isCommon
      ? `${props.context.systemName}-common-${id}`
      : `${props.context.systemName}-${props.context.envType}-${id}`;
    super(scope, myId, props);
  }
}
