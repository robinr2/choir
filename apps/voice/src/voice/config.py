from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    xai_api_key: SecretStr = Field(default=...)
    core_url: str = 'http://localhost:3000'
