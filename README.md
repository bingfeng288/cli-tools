# CLI Tools Collection

[中文文档](#中文文档) | [English](#english)

A collection of 38 lightweight, dependency-free CLI tools built with pure Node.js.

## Features

- **Zero Dependencies** - Built entirely with Node.js built-in modules
- **Cross-Platform** - Works on macOS, Linux, and Windows
- **Pipe-Friendly** - Supports stdin/stdout piping
- **Color Output** - Beautiful terminal output with ANSI colors
- **JSON Support** - Many tools support `--json` output

## Installation

```bash
# Clone the repository
git clone https://github.com/bingfeng288/cli-tools.git
cd cli-tools

# Install all tools globally
npm run install:all
```

## Tools

All tools are in the `tools/` directory.

### CSV Tools

| Tool | Description | Example |
|------|-------------|---------|
| csvsql | Query CSV with SQL syntax | `csvsql data.csv "SELECT * WHERE age > 30"` |
| csvsort | Sort CSV by columns | `csvsort data.csv -k age -r` |
| csvfilter | Filter rows by conditions | `csvfilter data.csv "age>30&status=active"` |
| csvdiff | Compare two CSV files | `csvdiff old.csv new.csv -k id` |
| csvmerge | Join two CSV files | `csvmerge users.csv orders.csv -k user_id` |
| csvpivot | Create pivot tables | `csvpivot sales.csv -r product -c region -v amount` |
| csvstats | Column statistics | `csvstats data.csv -c age,salary` |
| csvsum | Aggregate functions | `csvsum data.csv -c salary -a sum,avg -g dept` |
| csvsplit | Split large CSV files | `csvsplit data.csv -n 1000` |
| csvsample | Random row sampling | `csvsample data.csv -n 100 --seed 42` |
| csvclean | Clean and normalize | `csvclean data.csv --dedupe --trim` |
| csvtranspose | Transpose rows/columns | `csvtranspose data.csv` |
| csvflatten | JSON to flat CSV | `csvflatten data.json` |
| csvheader | Manage headers | `csvheader data.csv --lowercase` |
| csv2json | CSV to JSON | `csv2json data.csv` |
| json2csv | JSON to CSV | `json2csv data.json` |

### JSON Tools

| Tool | Description | Example |
|------|-------------|---------|
| jsondiff | Compare JSON files | `jsondiff a.json b.json` |
| jsonschema | Validate JSON Schema | `jsonschema data.json schema.json` |
| jsonpatch | Apply JSON Patch | `jsonpatch data.json patch.json` |
| jsonfmt | Format JSON | `jsonfmt data.json --indent 4` |
| jsonq | Query JSON | `jsonq data.json "users[0].name"` |
| jsontree | Tree view | `jsontree data.json` |
| tomlparse | Parse TOML | `tomlparse config.toml` |
| xmlparse | Parse XML | `xmlparse data.xml` |

### Encoding Tools

| Tool | Description | Example |
|------|-------------|---------|
| base64 | Base64 encode/decode | `base64 encode "Hello"` |
| urlencode | URL encode/decode | `urlencode encode "Hello World"` |
| hasher | Generate hashes | `hasher sha256 "data"` |
| jwtdecode | Decode JWT tokens | `jwtdecode eyJhbG...` |
| qrcode | Generate QR codes | `qrcode "https://example.com"` |

### System Tools

| Tool | Description | Example |
|------|-------------|---------|
| diskusage | Disk usage analyzer | `diskusage /path` |
| processinfo | Process information | `processinfo --sort cpu` |
| netinfo | Network information | `netinfo interfaces` |
| symlinks | Symlink manager | `symlinks find /path` |
| chmodcalc | Chmod calculator | `chmodcalc 755` |
| datetime | Date/time utility | `datetime now` |
| color | Color utility | `color hex ff0000` |
| diffstat | Diff statistics | `git diff \| diffstat` |
| envdiff | Env file diff | `envdiff .env .env.prod` |

---

## 中文文档

### 简介

这是一系列轻量级、无依赖的命令行工具，全部使用 Node.js 内置模块构建，共 38 个。

### 特点

- **零依赖** - 完全使用 Node.js 内置模块
- **跨平台** - 支持 macOS、Linux 和 Windows
- **管道友好** - 支持 stdin/stdout 管道
- **彩色输出** - 美丽的 ANSI 终端输出
- **JSON 支持** - 多数工具支持 `--json` 输出

### 安装

```bash
# 克隆仓库
git clone https://github.com/bingfeng288/cli-tools.git
cd cli-tools

# 安装所有工具到全局
npm run install:all
```

### 工具列表

所有工具都在 `tools/` 目录下。

#### CSV 工具

| 命令 | 说明 | 示例 |
|------|------|------|
| csvsql | SQL 查询 CSV | `csvsql data.csv "SELECT * WHERE age > 30"` |
| csvsort | CSV 排序 | `csvsort data.csv -k age -r` |
| csvfilter | CSV 过滤 | `csvfilter data.csv "age>30"` |
| csvdiff | CSV 比较 | `csvdiff old.csv new.csv -k id` |
| csvmerge | CSV 合并 | `csvmerge users.csv orders.csv -k user_id` |
| csvpivot | 透视表 | `csvpivot sales.csv -r product -c region -v amount` |
| csvstats | 统计分析 | `csvstats data.csv -c age,salary` |
| csvsum | 聚合计算 | `csvsum data.csv -c salary -a sum,avg -g dept` |
| csvsplit | 分割文件 | `csvsplit data.csv -n 1000` |
| csvsample | 随机采样 | `csvsample data.csv -n 100` |
| csvclean | 清洗数据 | `csvclean data.csv --dedupe --trim` |
| csvtranspose | 转置 | `csvtranspose data.csv` |
| csvflatten | JSON 转 CSV | `csvflatten data.json` |
| csvheader | 表头管理 | `csvheader data.csv --lowercase` |
| csv2json | CSV 转 JSON | `csv2json data.json` |
| json2csv | JSON 转 CSV | `json2csv data.json` |

#### JSON 工具

| 命令 | 说明 | 示例 |
|------|------|------|
| jsondiff | JSON 比较 | `jsondiff a.json b.json` |
| jsonschema | Schema 验证 | `jsonschema data.json schema.json` |
| jsonpatch | JSON Patch | `jsonpatch data.json patch.json` |
| jsonfmt | 格式化 JSON | `jsonfmt data.json --indent 4` |
| jsonq | 查询 JSON | `jsonq data.json "users[0].name"` |
| jsontree | 树形视图 | `jsontree data.json` |
| tomlparse | 解析 TOML | `tomlparse config.toml` |
| xmlparse | 解析 XML | `xmlparse data.xml` |

#### 编码工具

| 命令 | 说明 | 示例 |
|------|------|------|
| base64 | Base64 编解码 | `base64 encode "Hello"` |
| urlencode | URL 编解码 | `urlencode encode "Hello World"` |
| hasher | 哈希生成 | `hasher sha256 "data"` |
| jwtdecode | JWT 解码 | `jwtdecode eyJhbG...` |
| qrcode | 二维码生成 | `qrcode "https://example.com"` |

#### 系统工具

| 命令 | 说明 | 示例 |
|------|------|------|
| diskusage | 磁盘分析 | `diskusage /path` |
| processinfo | 进程信息 | `processinfo --sort cpu` |
| netinfo | 网络信息 | `netinfo interfaces` |
| symlinks | 符号链接管理 | `symlinks find /path` |
| chmodcalc | 权限计算器 | `chmodcalc 755` |
| datetime | 日期时间 | `datetime now` |
| color | 颜色工具 | `color hex ff0000` |
| diffstat | Diff 统计 | `git diff \| diffstat` |
| envdiff | 环境变量比较 | `envdiff .env .env.prod` |

---

## Project Structure

```
cli-tools/
├── tools/              # All 38 tools
│   ├── base64/
│   ├── csvsql/
│   ├── jsondiff/
│   ├── qrcode/
│   └── ...
├── install-all.js      # Install script
├── package.json
└── README.md
```

## License

ISC
