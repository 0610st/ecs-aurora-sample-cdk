#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { CicdSampleStack } from '../lib/cicd-sample-stack';

const app = new cdk.App();
new CicdSampleStack(app, 'CicdSampleStack');
