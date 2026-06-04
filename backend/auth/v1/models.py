from dataclasses import dataclass


@dataclass
class User:
    username: str
    name: str
    email: str
    group: str
    access_level: str        # "admin" | "viewer"
    resources: list[str]     # ["table", "hoo"] or subset

    def can_read(self, resource: str) -> bool:
        return resource in self.resources

    def can_write(self, resource: str) -> bool:
        return self.access_level == "admin" and resource in self.resources
