import { RemovalPolicy } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import * as codecommit from 'aws-cdk-lib/aws-codecommit';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as codepipeline from 'aws-cdk-lib/aws-codepipeline';
import * as codepipeline_actions from 'aws-cdk-lib/aws-codepipeline-actions';
import { createResourceName } from '../util';
import { BaseStack, BaseStackProps } from '../abstract/BaseStack';

export interface CicdStackDependencyProps {
  codeRepository: codecommit.Repository;
  ecrRepository: ecr.Repository;
  fargateService: ecs.FargateService;
}

export class CicdStack extends BaseStack {
  constructor(scope: Construct, id: string, deps: CicdStackDependencyProps, props: BaseStackProps) {
    super(scope, id, props);

    // CodeBuild Project
    const buildProjectName = createResourceName(props.context.systemName, props.context.envType, 'build');
    const buildProject = new codebuild.PipelineProject(this, 'BuildProject', {
      logging: {
        cloudWatch: {
          logGroup: new logs.LogGroup(this, `LogGroup-${buildProjectName}`, {
            logGroupName: `/aws/codebuild/${buildProjectName}`,
            retention: logs.RetentionDays.ONE_WEEK,
            removalPolicy: RemovalPolicy.DESTROY,
          }),
        },
      },
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_4_0,
        privileged: true,
      },
    });
    buildProject.addToRolePolicy(
      new iam.PolicyStatement({
        resources: ['*'],
        actions: [
          'ecr:BatchCheckLayerAvailability',
          'ecr:CompleteLayerUpload',
          'ecr:GetAuthorizationToken',
          'ecr:InitiateLayerUpload',
          'ecr:PutImage',
          'ecr:UploadLayerPart',
        ],
      }),
    );

    // CodePipeline
    const sourceOutput = new codepipeline.Artifact();
    const buildOutput = new codepipeline.Artifact();
    new codepipeline.Pipeline(this, createResourceName(props.context.systemName, props.context.envType, 'Pipeline'), {
      stages: [
        {
          stageName: 'Source',
          actions: [
            new codepipeline_actions.CodeCommitSourceAction({
              actionName: 'CodeCommit',
              repository: deps.codeRepository,
              output: sourceOutput,
            }),
          ],
        },
        {
          stageName: 'Build',
          actions: [
            new codepipeline_actions.CodeBuildAction({
              actionName: 'CodeBuild',
              project: buildProject,
              input: sourceOutput,
              outputs: [buildOutput],
              environmentVariables: {
                ECR_REPO_NAME: { value: deps.ecrRepository.repositoryName },
                AWS_ACCOUNT_ID: { value: props?.env?.account as unknown as string },
                AWS_DEFAULT_REGION: { value: props?.env?.region as unknown as string },
              },
            }),
          ],
        },
        {
          stageName: 'Deploy',
          actions: [
            new codepipeline_actions.EcsDeployAction({
              actionName: 'CodeDeploy',
              service: deps.fargateService,
              input: buildOutput,
            }),
          ],
        },
      ],
    });
  }
}
