"""
Setup script for Glowworm Display Device Daemon
"""
from setuptools import setup, find_packages

with open("README.md", "r", encoding="utf-8") as fh:
    long_description = fh.read()

setup(
    name="glowworm-daemon",
    version="1.0.0",
    author="Glowworm Team",
    description="Display device daemon for Glowworm digital signage system",
    long_description=long_description,
    long_description_content_type="text/markdown",
    packages=find_packages(),
    classifiers=[
        "Development Status :: 4 - Beta",
        "Intended Audience :: System Administrators",
        "Topic :: System :: Hardware",
        "License :: OSI Approved :: MIT License",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "Programming Language :: Python :: 3.12",
    ],
    python_requires=">=3.10",
    install_requires=[
        "requests>=2.31.0",
        "urllib3>=2.0.0",
    ],
    extras_require={
        "cec": ["cec>=0.2.7"],
        "dev": ["pytest>=7.4.0", "pytest-cov>=4.1.0", "black>=23.0.0", "flake8>=6.0.0"],
    },
    entry_points={
        "console_scripts": [
            "glowworm-daemon=glowworm_daemon.main:main",
            "glowworm-daemon-setup=glowworm_daemon.setup:setup_wizard",
        ],
    },
    include_package_data=True,
    package_data={
        "glowworm_daemon": ["templates/*"],
    },
)

