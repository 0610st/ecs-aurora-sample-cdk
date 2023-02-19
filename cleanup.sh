#!/bin/bash

stacks=`cdk ls`
for stack in $stacks
do
  echo "exec: cdk destroy ${stack} --force"
  cdk destroy ${stack} --force
  echo "done: cdk destroy ${stack} --force"
done