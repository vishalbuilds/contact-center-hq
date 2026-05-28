import boto3
from botocore.exceptions import ClientError
from typing import Any, Dict, List, Optional
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

_cache: dict[str, "DynamoDB"] = {}


def ping(region: str) -> None:
    """Verify DynamoDB is reachable. Raises on failure."""
    boto3.client("dynamodb", region_name=region).list_tables(Limit=1)


def get_table(table_name: str, region: str) -> "DynamoDB":
    """Return a cached DynamoDB instance for the given table."""
    if table_name not in _cache:
        _cache[table_name] = DynamoDB(table_name, region)
    return _cache[table_name]


class DynamoDB:
    def __init__(self, table_name: str, region: str):
        self.table_name = table_name
        self.region = region
        self.table = boto3.resource("dynamodb", region_name=region).Table(table_name)

    def put_attr(self, item: Dict[str, Any], condition_expression: Optional[str] = None) -> Dict:
        try:
            kwargs = {"Item": item}
            if condition_expression:
                kwargs["ConditionExpression"] = condition_expression
            response = self.table.put_item(**kwargs)
            logger.info(f"Item inserted into {self.table_name}")
            return response
        except ClientError as e:
            logger.error(f"put_attr error: {e.response['Error']['Message']}")
            raise

    def get_attr(self, key: Dict[str, Any], consistent_read: bool = False) -> Optional[Dict]:
        try:
            response = self.table.get_item(Key=key, ConsistentRead=consistent_read)
            item = response.get("Item")
            if item:
                logger.info(f"Item retrieved from {self.table_name}")
            else:
                logger.info(f"Item not found in {self.table_name} for key: {key}")
            return item
        except ClientError as e:
            logger.error(f"get_attr error: {e.response['Error']['Message']}")
            raise

    def query_attr(
        self,
        key_condition: Any,
        filter_expression: Optional[Any] = None,
        index_name: Optional[str] = None,
        limit: Optional[int] = None,
        scan_index_forward: bool = True,
    ) -> List[Dict]:
        try:
            kwargs = {
                "KeyConditionExpression": key_condition,
                "ScanIndexForward": scan_index_forward,
            }
            if filter_expression is not None:
                kwargs["FilterExpression"] = filter_expression
            if index_name:
                kwargs["IndexName"] = index_name
            if limit:
                kwargs["Limit"] = limit

            items = []
            response = self.table.query(**kwargs)
            items.extend(response.get("Items", []))
            while "LastEvaluatedKey" in response and (not limit or len(items) < limit):
                kwargs["ExclusiveStartKey"] = response["LastEvaluatedKey"]
                response = self.table.query(**kwargs)
                items.extend(response.get("Items", []))

            logger.info(f"Query returned {len(items)} items from {self.table_name}")
            return items[:limit] if limit else items
        except ClientError as e:
            logger.error(f"query_attr error: {e.response['Error']['Message']}")
            raise

    def scan_attr(
        self,
        filter_expression: Optional[Any] = None,
        limit: Optional[int] = None,
        projection_expression: Optional[str] = None,
    ) -> List[Dict]:
        try:
            kwargs: dict = {}
            if filter_expression is not None:
                kwargs["FilterExpression"] = filter_expression
            if limit:
                kwargs["Limit"] = limit
            if projection_expression:
                kwargs["ProjectionExpression"] = projection_expression

            items = []
            response = self.table.scan(**kwargs)
            items.extend(response.get("Items", []))
            while "LastEvaluatedKey" in response and (not limit or len(items) < limit):
                kwargs["ExclusiveStartKey"] = response["LastEvaluatedKey"]
                response = self.table.scan(**kwargs)
                items.extend(response.get("Items", []))

            logger.info(f"Scan returned {len(items)} items from {self.table_name}")
            return items[:limit] if limit else items
        except ClientError as e:
            logger.error(f"scan_attr error: {e.response['Error']['Message']}")
            raise

    def update_attr(
        self,
        key: Dict[str, Any],
        updates: Dict[str, Any],
        condition_expression: Optional[str] = None,
    ) -> Dict:
        try:
            update_expr_parts = []
            expr_attr_values = {}
            expr_attr_names = {}
            for i, (attr_name, attr_value) in enumerate(updates.items()):
                placeholder_name = f"#attr{i}"
                placeholder_value = f":val{i}"
                update_expr_parts.append(f"{placeholder_name} = {placeholder_value}")
                expr_attr_names[placeholder_name] = attr_name
                expr_attr_values[placeholder_value] = attr_value

            kwargs = {
                "Key": key,
                "UpdateExpression": "SET " + ", ".join(update_expr_parts),
                "ExpressionAttributeNames": expr_attr_names,
                "ExpressionAttributeValues": expr_attr_values,
                "ReturnValues": "ALL_NEW",
            }
            if condition_expression:
                kwargs["ConditionExpression"] = condition_expression

            response = self.table.update_item(**kwargs)
            logger.info(f"Item updated in {self.table_name}")
            return response.get("Attributes", {})
        except ClientError as e:
            logger.error(f"update_attr error: {e.response['Error']['Message']}")
            raise

    def delete_attr(self, key: Dict[str, Any], condition_expression: Optional[str] = None) -> Dict:
        try:
            kwargs = {"Key": key, "ReturnValues": "ALL_OLD"}
            if condition_expression:
                kwargs["ConditionExpression"] = condition_expression
            response = self.table.delete_item(**kwargs)
            logger.info(f"Item deleted from {self.table_name}")
            return response.get("Attributes", {})
        except ClientError as e:
            logger.error(f"delete_attr error: {e.response['Error']['Message']}")
            raise
