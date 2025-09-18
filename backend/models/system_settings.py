"""
SystemSettings model for database-based configuration management
"""
from sqlalchemy import Column, Integer, String, Text, Boolean, TIMESTAMP, Enum, Index
from sqlalchemy.sql import func
from models.database import Base
import enum


class SettingType(str, enum.Enum):
    """Enum for setting value types"""
    STRING = "string"
    NUMBER = "number"
    BOOLEAN = "boolean"
    JSON = "json"


class SystemSettings(Base):
    """Model for storing system configuration in database"""
    __tablename__ = "system_settings"

    id = Column(Integer, primary_key=True, index=True)
    setting_key = Column(String(100), unique=True, nullable=False, index=True)
    setting_value = Column(Text, nullable=True)
    setting_type = Column(Enum(SettingType), nullable=False, default=SettingType.STRING)
    description = Column(Text, nullable=True)
    is_sensitive = Column(Boolean, nullable=False, default=False)
    created_at = Column(TIMESTAMP, nullable=False, server_default=func.current_timestamp())
    updated_at = Column(TIMESTAMP, nullable=False, server_default=func.current_timestamp(), onupdate=func.current_timestamp())

    def to_dict(self) -> dict:
        """Convert model to dictionary"""
        return {
            "id": self.id,
            "setting_key": self.setting_key,
            "setting_value": self.setting_value,
            "setting_type": self.setting_type.value,
            "description": self.description,
            "is_sensitive": self.is_sensitive,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }

    def get_typed_value(self):
        """Get the setting value converted to its proper type"""
        if self.setting_value is None:
            return None
            
        if self.setting_type == SettingType.STRING:
            return self.setting_value
        elif self.setting_type == SettingType.NUMBER:
            try:
                # Try integer first, then float
                if '.' in self.setting_value:
                    return float(self.setting_value)
                else:
                    return int(self.setting_value)
            except ValueError:
                return self.setting_value  # Return as string if conversion fails
        elif self.setting_type == SettingType.BOOLEAN:
            return self.setting_value.lower() in ('true', '1', 'yes', 'on')
        elif self.setting_type == SettingType.JSON:
            import json
            try:
                return json.loads(self.setting_value)
            except (json.JSONDecodeError, TypeError):
                return self.setting_value  # Return as string if JSON parsing fails
        else:
            return self.setting_value

    def set_typed_value(self, value):
        """Set the setting value from a typed value"""
        if self.setting_type == SettingType.STRING:
            self.setting_value = str(value) if value is not None else None
        elif self.setting_type == SettingType.NUMBER:
            self.setting_value = str(value) if value is not None else None
        elif self.setting_type == SettingType.BOOLEAN:
            self.setting_value = str(bool(value)).lower()
        elif self.setting_type == SettingType.JSON:
            import json
            self.setting_value = json.dumps(value) if value is not None else None
        else:
            self.setting_value = str(value) if value is not None else None

    @classmethod
    def from_dict(cls, data: dict):
        """Create model instance from dictionary"""
        instance = cls()
        instance.setting_key = data.get('setting_key')
        instance.setting_value = data.get('setting_value')
        instance.setting_type = SettingType(data.get('setting_type', 'string'))
        instance.description = data.get('description')
        instance.is_sensitive = data.get('is_sensitive', False)
        return instance

    def __repr__(self):
        return f"<SystemSettings(id={self.id}, key='{self.setting_key}', type='{self.setting_type.value}')>"
