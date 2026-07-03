# mysqldumpslow.js

[🇧🇷 Ler em português](./README.pt-br.md)

A **Node.js port** of MySQL's classic `mysqldumpslow.pl` — the tool that parses and summarizes the MySQL slow query log by grouping similar queries together.

No dependencies. Single file. Same command-line interface as the original Perl script.

## Why

`mysqldumpslow.pl` ships with MySQL but requires Perl. This port lets you run the same tool anywhere Node.js is available, with identical parsing logic (record splitting, number/string abstraction, sorting, and summary output).

## Requirements

- Node.js 14+

## Usage

```bash
node mysqldumpslow.js [OPTIONS] [LOG_FILES...]
```

If no log file is given, the script tries to auto-detect it by calling `my_print_defaults` (only works on a machine with MySQL installed). In most cases, just pass the file directly:

```bash
node mysqldumpslow.js /var/log/mysql/slow.log
```

### Examples

```bash
# Top 10 slowest queries (by average time)
node mysqldumpslow.js -t 10 /var/log/mysql/slow.log

# Sort by number of occurrences instead of time
node mysqldumpslow.js -s c /var/log/mysql/slow.log

# Only show queries matching a pattern
node mysqldumpslow.js -g orders /var/log/mysql/slow.log

# Combine multiple log files
node mysqldumpslow.js /var/log/mysql/slow.log /var/log/mysql/slow.log.1
```

## Options

| Flag | Description |
|------|-------------|
| `-s ORDER` | What to sort by: `al`, `at`, `ar`, `c`, `l`, `r`, `t` (default: `at`, average query time) |
| `-r` | Reverse the sort order (largest last instead of first) |
| `-t NUM` | Only show the top N queries |
| `-a` | Don't abstract numbers to `N` and strings to `'S'` |
| `-n NUM` | Abstract numbers with at least N digits within names (e.g. `log_20001231` → `log_NNNNNNNN`) |
| `-g PATTERN` | Only consider statements that match this pattern |
| `-h HOSTNAME` | Hostname of the DB server for `*-slow.log` filename (wildcard supported, default `*`) |
| `-i NAME` | Server instance name (if using the `mysql.server` startup script) |
| `-l` | Don't subtract lock time from total time |
| `-v` | Verbose |
| `-d` | Debug |
| `--help` | Show usage |

Sort keys: `at` = average query time, `al` = average lock time, `ar` = average rows sent, `c` = count, `t`/`l`/`r` = total time/lock/rows.

## Sample output

```
Count: 2  Time=1.00s (1s)  Lock=0.00s (0s)  Rows=7.5 (15), appuser[appuser]@2hosts
  SELECT * FROM users WHERE id = N AND name = 'S'
```

## Credits

Based on `mysqldumpslow.pl`, © Oracle and/or its affiliates, licensed under GPLv2. This is an independent Node.js reimplementation for portability, not an official Oracle/MySQL project.

## License

GPL-2.0, consistent with the original script.

# mysqldumpslow.js

[🇺🇸 Read in English](./README.md)

Uma **versão em Node.js** do clássico `mysqldumpslow.pl` do MySQL — a ferramenta que analisa e resume o slow query log agrupando queries parecidas.

Sem dependências. Um único arquivo. Mesma interface de linha de comando do script Perl original.

## Por quê

O `mysqldumpslow.pl` vem junto com o MySQL, mas exige Perl instalado. Esta versão permite rodar a mesma ferramenta em qualquer lugar que tenha Node.js, com a mesma lógica de parsing (divisão de registros, abstração de números/strings, ordenação e resumo).

## Requisitos

- Node.js 14+

## Como usar

```bash
node mysqldumpslow.js [OPÇÕES] [ARQUIVOS_DE_LOG...]
```

Se nenhum arquivo for informado, o script tenta descobrir o log automaticamente chamando `my_print_defaults` (só funciona em máquinas com MySQL instalado). Na maioria dos casos, basta passar o arquivo direto:

```bash
node mysqldumpslow.js /var/log/mysql/slow.log
```

### Exemplos

```bash
# Top 10 queries mais lentas (por tempo médio)
node mysqldumpslow.js -t 10 /var/log/mysql/slow.log

# Ordenar por número de ocorrências em vez de tempo
node mysqldumpslow.js -s c /var/log/mysql/slow.log

# Mostrar só queries que batem com um padrão
node mysqldumpslow.js -g orders /var/log/mysql/slow.log

# Combinar vários arquivos de log
node mysqldumpslow.js /var/log/mysql/slow.log /var/log/mysql/slow.log.1
```

## Opções

| Flag | Descrição |
|------|-----------|
| `-s ORDER` | Critério de ordenação: `al`, `at`, `ar`, `c`, `l`, `r`, `t` (padrão: `at`, tempo médio de query) |
| `-r` | Inverte a ordem (maiores por último em vez de primeiro) |
| `-t NUM` | Mostra só as N queries do topo |
| `-a` | Não abstrai números para `N` nem strings para `'S'` |
| `-n NUM` | Abstrai números com pelo menos N dígitos dentro de nomes (ex: `log_20001231` → `log_NNNNNNNN`) |
| `-g PADRÃO` | Considera só statements que batem com esse padrão |
| `-h HOSTNAME` | Hostname do servidor de banco para o arquivo `*-slow.log` (aceita wildcard, padrão `*`) |
| `-i NOME` | Nome da instância do servidor (se usar o script de start `mysql.server`) |
| `-l` | Não subtrai o tempo de lock do tempo total |
| `-v` | Modo verboso |
| `-d` | Modo debug |
| `--help` | Mostra a ajuda |

Chaves de ordenação: `at` = tempo médio de query, `al` = tempo médio de lock, `ar` = média de linhas retornadas, `c` = contagem, `t`/`l`/`r` = totais de tempo/lock/linhas.

## Exemplo de saída

```
Count: 2  Time=1.00s (1s)  Lock=0.00s (0s)  Rows=7.5 (15), appuser[appuser]@2hosts
  SELECT * FROM users WHERE id = N AND name = 'S'
```

## Créditos

Baseado no `mysqldumpslow.pl`, © Oracle e/ou suas afiliadas, licenciado sob GPLv2. Esta é uma reimplementação independente em Node.js para portabilidade, não é um projeto oficial da Oracle/MySQL.

## Licença

GPL-2.0, consistente com o script original.
