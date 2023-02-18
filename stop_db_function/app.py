import boto3
import os

def lambda_handler(event, context):
    try:
        target = os.environ.get('DB_CLUSTER_IDENTIFIER')
        print(f'target: {target}')
        client = boto3.client('rds')
        client.stop_db_cluster(
            DBClusterIdentifier=target
        )
        print('stop db cluster succeed.')
    except Exception as ex:
        print(f'stop db cluster failed {ex=}.')
