import { RemovalPolicy } from 'aws-cdk-lib';
import * as codecommit from 'aws-cdk-lib/aws-codecommit';
import { Construct } from 'constructs';
import { createResourceName } from '../../util';
import { BaseStack, BaseStackProps } from '../../abstract/BaseStack';

export class CommonStatefulStack extends BaseStack {
  public readonly codeRepository: codecommit.Repository;

  constructor(scope: Construct, id: string, props: BaseStackProps) {
    super(scope, id, props, true);

    // CodeCommit Repository
    this.codeRepository = this.createCodeCommitRepository(this, props);
  }

  private createCodeCommitRepository(scope: Construct, props: BaseStackProps): codecommit.Repository {
    const repositoryName = createResourceName(props.context.systemName, 'common', 'backend-repo');
    const repository = new codecommit.Repository(scope, 'CodeCommitRepository', {
      repositoryName: repositoryName,
    });
    repository.applyRemovalPolicy(RemovalPolicy.RETAIN);

    return repository;
  }
}
