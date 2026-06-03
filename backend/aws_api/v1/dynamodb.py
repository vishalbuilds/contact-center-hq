from botocore.exceptions import ClientError
from typing import Any, Dict, List, Optional, Tuple
from decimal import Decimal
from contextlib import contextmanager
import logging

from aws_api.v1.aws_clients import dynamo_resource as DynamoDB_resource

logging.basicConfig(level=logging.WARNING)
logger = logging.getLogger(__name__)


def json_safe(obj: Any) -> Any:
    if isinstance(obj, Decimal):
        return int(obj) if obj == int(obj) else float(obj)
    if isinstance(obj, dict):
        return {k: json_safe(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [json_safe(i) for i in obj]
    return obj


def ping() -> None:
    DynamoDB_resource.meta.client.list_tables(Limit=1)


class DynamoDB:
    _cache: dict[str, "DynamoDB"] = {}

    def __init__(self, table_name: str):
        self.table_name = table_name
        self.table = DynamoDB_resource.Table(table_name)

    @classmethod
    def get_instance(cls, table_name: str) -> "DynamoDB":
        if table_name not in cls._cache:
            cls._cache[table_name] = cls(table_name)
        return cls._cache[table_name]

    @classmethod
    @contextmanager
    def _session(cls, table_name: str):
        yield cls.get_instance(table_name)

    @staticmethod
    def _paginate(operation, kwargs: Dict[str, Any], limit: Optional[int]) -> List[Dict]:
        items: List[Dict] = []
        response = operation(**kwargs)
        items.extend(response.get("Items", []))
        while "LastEvaluatedKey" in response and (not limit or len(items) < limit):
            kwargs["ExclusiveStartKey"] = response["LastEvaluatedKey"]
            response = operation(**kwargs)
            items.extend(response.get("Items", []))
        return items[:limit] if limit else items

    @staticmethod
    def _build_update_expression(updates: Dict[str, Any]) -> Tuple[str, Dict[str, str], Dict[str, Any]]:
        parts: List[str] = []
        names: Dict[str, str] = {}
        values: Dict[str, Any] = {}
        for i, (k, v) in enumerate(updates.items()):
            parts.append(f"#a{i} = :v{i}")
            names[f"#a{i}"] = k
            values[f":v{i}"] = v
        return "SET " + ", ".join(parts), names, values

    @classmethod
    def put(cls, table_name: str,  item: Dict[str, Any], condition_expression: Optional[Any] = None) -> Dict:
        with cls._session(table_name) as instance:
            try:
                kwargs: Dict[str, Any] = {"Item": item, "ReturnValues": "ALL_OLD"}
                if condition_expression is not None:
                    kwargs["ConditionExpression"] = condition_expression
                response = instance.table.put_item(**kwargs)
                logger.info(f"Item inserted into {instance.table_name}: {list(item.keys())}")
                return response.get("Attributes", {})
            except ClientError as e:
                logger.error(f"put error: {e.response['Error']['Message']}")
                raise

    @classmethod
    def get(cls, table_name: str,  key: Dict[str, Any], consistent_read: bool = False) -> Optional[Dict]:
        with cls._session(table_name) as instance:
            try:
                response = instance.table.get_item(Key=key, ConsistentRead=consistent_read)
                item = response.get("Item")
                if item:
                    logger.info(f"Item retrieved from {instance.table_name}: {key}")
                else:
                    logger.info(f"Item not found in {instance.table_name}: {key}")
                return item
            except ClientError as e:
                logger.error(f"get error: {e.response['Error']['Message']}")
                raise

    @classmethod
    def query(
        cls,
        table_name: str,
        key_condition: Any,
        filter_expression: Optional[Any] = None,
        index_name: Optional[str] = None,
        limit: Optional[int] = None,
        scan_index_forward: bool = True,
    ) -> List[Dict]:
        with cls._session(table_name) as instance:
            try:
                kwargs: Dict[str, Any] = {
                    "KeyConditionExpression": key_condition,
                    "ScanIndexForward": scan_index_forward,
                }
                if filter_expression is not None:
                    kwargs["FilterExpression"] = filter_expression
                if index_name is not None:
                    kwargs["IndexName"] = index_name
                if limit:
                    kwargs["Limit"] = limit
                items = cls._paginate(instance.table.query, kwargs, limit)
                logger.info(f"Query returned {len(items)} items from {instance.table_name}")
                return items
            except ClientError as e:
                logger.error(f"query error: {e.response['Error']['Message']}")
                raise

    @classmethod
    def scan(
        cls,
        table_name: str,
        
        filter_expression: Optional[Any] = None,
        limit: Optional[int] = None,
        projection_expression: Optional[str] = None,
        expression_attribute_names: Optional[Dict[str, str]] = None,
    ) -> List[Dict]:
        with cls._session(table_name) as instance:
            try:
                kwargs: Dict[str, Any] = {}
                if filter_expression is not None:
                    kwargs["FilterExpression"] = filter_expression
                if limit:
                    kwargs["Limit"] = limit
                if projection_expression is not None:
                    kwargs["ProjectionExpression"] = projection_expression
                if expression_attribute_names is not None:
                    kwargs["ExpressionAttributeNames"] = expression_attribute_names
                items = cls._paginate(instance.table.scan, kwargs, limit)
                logger.info(f"Scan returned {len(items)} items from {instance.table_name}")
                return items
            except ClientError as e:
                logger.error(f"scan error: {e.response['Error']['Message']}")
                raise

    @classmethod
    def update(
        cls,
        table_name: str,
        
        key: Dict[str, Any],
        updates: Dict[str, Any],
        condition_expression: Optional[Any] = None,
    ) -> Dict:
        if not updates:
            return {}
        with cls._session(table_name) as instance:
            try:
                expr, names, values = cls._build_update_expression(updates)
                kwargs: Dict[str, Any] = {
                    "Key": key,
                    "UpdateExpression": expr,
                    "ExpressionAttributeNames": names,
                    "ExpressionAttributeValues": values,
                    "ReturnValues": "ALL_NEW",
                }
                if condition_expression is not None:
                    kwargs["ConditionExpression"] = condition_expression
                response = instance.table.update_item(**kwargs)
                logger.info(f"Item updated in {instance.table_name}: {key}")
                return response.get("Attributes", {})
            except ClientError as e:
                logger.error(f"update error: {e.response['Error']['Message']}")
                raise

    @classmethod
    def delete(cls, table_name: str,  key: Dict[str, Any], condition_expression: Optional[Any] = None) -> Dict:
        with cls._session(table_name) as instance:
            try:
                kwargs: Dict[str, Any] = {"Key": key, "ReturnValues": "ALL_OLD"}
                if condition_expression is not None:
                    kwargs["ConditionExpression"] = condition_expression
                response = instance.table.delete_item(**kwargs)
                logger.info(f"Item deleted from {instance.table_name}: {key}")
                return response.get("Attributes", {})
            except ClientError as e:
                logger.error(f"delete error: {e.response['Error']['Message']}")
                raise
 