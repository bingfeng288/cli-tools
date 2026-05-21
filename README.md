# CLI Tools Collection

[中文文档](#中文文档) | [English](#english)

A collection of lightweight, dependency-free CLI tools built with pure Node.js.

## Features

- **Zero Dependencies** - Built entirely with Node.js built-in modules
- **Cross-Platform** - Works on macOS, Linux, and Windows
- **Pipe-Friendly** - Supports stdin/stdout piping
- **Color Output** - Beautiful terminal output with ANSI colors
- **JSON Support** - Many tools support `--json` output

## Installation

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/cli-tools.git
cd cli-tools

# Install all tools
npm run install:all

# Or install individual tools
cd csv-tools/csvsort && npm link
```

## Tools Overview

### CSV Tools (csv-tools/)

| Tool | Description | Example |
|------|-------------|---------|
| [csvsql](csv-tools/csvsql/) | Query CSV with SQL syntax | `csvsql data.csv "SELECT * WHERE age > 30"` |
| [csvsort](csv-tools/csvsort/) | Sort CSV by columns | `csvsort data.csv -k age -r` |
| [csvfilter](csv-tools/csvfilter/) | Filter rows by conditions | `csvfilter data.csv "age>30&status=active"` |
| [csvdiff](csv-tools/csvdiff/) | Compare two CSV files | `csvdiff old.csv new.csv -k id` |
| [csvmerge](csv-tools/csvmerge/) | Join two CSV files | `csvmerge users.csv orders.csv -k user_id` |
| [csvpivot](csv-tools/csvpivot/) | Create pivot tables | `csvpivot sales.csv -r product -c region -v amount` |
| [csvstats](csv-tools/csvstats/) | Column statistics | `csvstats data.csv -c age,salary` |
| [csvsum](csv-tools/csvsum/) | Aggregate functions | `csvsum data.csv -c salary -a sum,avg -g dept` |
| [csvsplit](csv-tools/csvsplit/) | Split large CSV files | `csvsplit data.csv -n 1000` |
| [csvsample](csv-tools/csvsample/) | Random row sampling | `csvsample data.csv -n 100 --seed 42` |
| [csvclean](csv-tools/csvclean/) | Clean and normalize | `csvclean data.csv --dedupe --trim` |
| [csvtranspose](csv-tools/csvtranspose/) | Transpose rows/columns | `csvtranspose data.csv` |
| [csvflatten](csv-tools/csvflatten/) | JSON to flat CSV | `csvflatten data.json` |
| [csvheader](csv-tools/csvheader/) | Manage headers | `csvheader data.csv --lowercase` |
| [csv2json](csv-tools/csv2json/) | CSV to JSON | `csv2json data.csv` |
| [json2csv](csv-tools/json2csv/) | JSON to CSV | `json2csv data.json` |

### JSON Tools (json-tools/)

| Tool | Description | Example |
|------|-------------|---------|
| [jsondiff](json-tools/jsondiff/) | Compare JSON files | `jsondiff a.json b.json` |
| [jsonschema](json-tools/jsonschema/) | Validate JSON Schema | `jsonschema data.json schema.json` |
| [jsonpatch](json-tools/jsonpatch/) | Apply JSON Patch | `jsonpatch data.json patch.json` |
| [jsonfmt](json-tools/jsonfmt/) | Format JSON | `jsonfmt data.json --indent 4` |
| [jsonq](json-tools/jsonq/) | Query JSON | `jsonq data.json "users[0].name"` |
| [jsontree](json-tools/jsontree/) | Tree view | `jsontree data.json` |
| [tomlparse](json-tools/tomlparse/) | Parse TOML | `tomlparse config.toml` |
| [xmlparse](json-tools/xmlparse/) | Parse XML | `xmlparse data.xml` |

### Encoding Tools (encoding-tools/)

| Tool | Description | Example |
|------|-------------|---------|
| [base64](encoding-tools/base64/) | Base64 encode/decode | `base64 encode "Hello"` |
| [urlencode](encoding-tools/urlencode/) | URL encode/decode | `urlencode encode "Hello World"` |
| [hash](encoding-tools/hash/) | Generate hashes | `hash sha256 "data"` |
| [jwtdecode](encoding-tools/jwtdecode/) | Decode JWT tokens | `jwtdecode eyJhbG...` |
| [qrcode](encoding-tools/qrcode/) | Generate QR codes | `qrcode "https://example.com"` |

### System Tools (system-tools/)

| Tool | Description | Example |
|------|-------------|---------|
| [diskusage](system-tools/diskusage/) | Disk usage analyzer | `diskusage /path` |
| [processinfo](system-tools/processinfo/) | Process information | `processinfo --sort cpu` |
| [netinfo](system-tools/netinfo/) | Network information | `netinfo interfaces` |
| [symlinks](system-tools/symlinks/) | Symlink manager | `symlinks find /path` |
| [chmodcalc](system-tools/chmodcalc/) | Chmod calculator | `chmodcalc 755` |
| [datetime](system-tools/datetime/) | Date/time utility | `datetime now` |
| [color](system-tools/color/) | Color utility | `color "#ff0000"` |
| [diffstat](system-tools/diffstat/) | Diff statistics | `git diff \| diffstat` |
| [envdiff](system-tools/envdiff/) | Env file diff | `envdiff .env .env.prod` |

---

## 中文文档

### 简介

这是一系列轻量级、无依赖的命令行工具，全部使用 Node.js 内置模块构建。

### 特点

- **零依赖** - 完全使用 Node.js 内置模块
- **跨平台** - 支持 macOS、Linux 和 Windows
- **管道友好** - 支持 stdin/stdout 管道
- **彩色输出** - 美丽的 ANSI 终端输出
- **JSON 支持** - 多数工具支持 `--json` 输出

### 安装

```bash
# 克隆仓库
git clone https://github.com/YOUR_USERNAME/cli-tools.git
cd cli-tools

# 安装所有工具
npm run install:all

# 或安装单个工具
cd csv-tools/csvsort && npm link
```

### CSV 工具

#### csvsql - SQL 查询 CSV

使用 SQL 语法查询 CSV 文件。

```bash
# 基本查询
csvsql data.csv "SELECT * WHERE age > 30"

# 聚合查询
csvsql data.csv "SELECT department, AVG(salary) GROUP BY department"

# 排序和限制
csvsql data.csv "SELECT name, salary ORDER BY salary DESC LIMIT 10"
```

#### csvsort - CSV 排序

按列排序 CSV 文件。

```bash
# 按年龄排序
csvsort data.csv -k age

# 降序排序
csvsort data.csv -k salary -r

# 多列排序
csvsort data.csv -k lastname,firstname
```

#### csvfilter - CSV 过滤

按条件过滤 CSV 行。

```bash
# 简单条件
csvfilter data.csv "age>30"

# 复合条件
csvfilter data.csv "age>25&status=active"

# 模糊匹配
csvfilter data.csv "name~John"
```

#### csvdiff - CSV 比较

比较两个 CSV 文件的差异。

```bash
# 基本比较
csvdiff old.csv new.csv

# 指定关键列
csvdiff old.csv new.csv -k id

# JSON 输出
csvdiff old.csv new.csv --json
```

#### csvmerge - CSV 合并

按列合并两个 CSV 文件。

```bash
# 内连接
csvmerge users.csv orders.csv -k user_id

# 左连接
csvmerge users.csv orders.csv -k user_id -t left

# 填充缺失值
csvmerge a.csv b.csv -k id --fill N/A
```

#### csvpivot - 透视表

创建数据透视表。

```bash
# 基本透视
csvpivot sales.csv -r product -c region -v amount

# 指定聚合函数
csvpivot data.csv -r dept -c status -v count -a count
```

#### csvstats - 统计分析

计算列统计信息。

```bash
# 所有列统计
csvstats data.csv

# 指定列
csvstats data.csv -c age,salary

# JSON 输出
csvstats data.csv --json
```

#### csvsplit - 分割文件

分割大 CSV 文件。

```bash
# 按行数分割
csvsplit data.csv -n 1000

# 按文件数分割
csvsplit data.csv -p 5

# 指定输出目录
csvsplit data.csv -n 500 -o output/
```

### JSON 工具

#### jsondiff - JSON 比较

比较两个 JSON 文件。

```bash
# 基本比较
jsondiff a.json b.json

# JSON Patch 输出
jsondiff a.json b.json --json
```

#### jsonschema - JSON Schema 验证

验证 JSON 是否符合 Schema。

```bash
# 验证文件
jsonschema data.json schema.json

# 验证 stdin
cat data.json | jsonschema schema.json
```

### 编码工具

#### base64 - Base64 编解码

```bash
# 编码
base64 encode "Hello World"

# 解码
base64 decode "SGVsbG8gV29ybGQ="

# 文件编码
base64 encode --file image.png
```

#### hash - 哈希生成

```bash
# SHA256
hash sha256 "Hello World"

# 文件哈希
hash sha256 --file data.txt

# HMAC
hash hmac-sha256 --secret "key" "message"
```

#### jwtdecode - JWT 解码

```bash
# 解码 JWT
jwtdecode eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0In0.xxx

# 验证签名
jwtdecode token.txt --secret my-secret
```

#### qrcode - 二维码生成

```bash
# 生成二维码
qrcode "https://example.com"

# 无边框
qrcode "Hello" --no-border
```

### 系统工具

#### diskusage - 磁盘使用分析

```bash
# 分析目录
diskusage /path

# 只显示目录
diskusage /path --dirs-only

# 按大小排序
diskusage /path --sort size
```

#### processinfo - 进程信息

```bash
# 查看所有进程
processinfo

# 按 CPU 排序
processinfo --sort cpu

# 按名称过滤
processinfo --name node
```

---

## Development

### Adding a New Tool

1. Create a new directory: `mkdir new-tool`
2. Create `package.json` with `"type": "module"`
3. Create the main `.js` file
4. Run `npm link` to install globally
5. Test the tool
6. Add to this README

### Project Structure

```
cli-tools/
├── csv-tools/          # CSV processing tools
├── json-tools/         # JSON processing tools
├── encoding-tools/     # Encoding/hashing tools
├── system-tools/       # System utility tools
├── package.json        # Root package.json
└── README.md           # This file
```

## License

ISC

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request
