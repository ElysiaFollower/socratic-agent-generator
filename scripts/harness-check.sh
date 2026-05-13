#!/usr/bin/env sh
# 职责：用确定、便宜的检查验证仓库 harness 合同。
# 边界：不要替代项目测试、执行网络 setup、安装依赖，或修改源码文件。

set -eu

failures=0
warnings=0

fail() {
  failures=$((failures + 1))
  printf '%s\n' "失败：$*"
}

warn() {
  warnings=$((warnings + 1))
  printf '%s\n' "警告：$*"
}

require_file() {
  if [ ! -f "$1" ]; then
    fail "缺少必要文件：$1。请运行 harness scaffold 或补齐该 harness 工件。"
  fi
}

require_dir() {
  if [ ! -d "$1" ]; then
    fail "缺少必要目录：$1。请创建目录并放置对应任务或文档。"
  fi
}

require_file "AGENTS.md"
require_file "init.sh"
require_file "docs/overview.md"
require_file "harness/bootstrap-contract.md"
require_file "harness/feature_list.json"
require_file "harness/progress.md"
require_file "harness/decisions.md"
require_file "harness/session-handoff.md"
require_file "harness/observability.md"
require_file "harness/evaluator-rubric.md"
require_file "harness/quality.md"
require_dir "plans/active"
require_dir "plans/archive"
require_dir "docs/architecture"

if [ -f "AGENTS.md" ]; then
  lines=$(wc -l < "AGENTS.md" | tr -d ' ')
  if [ "$lines" -gt 200 ]; then
    fail "AGENTS.md 有 $lines 行；入口文件应是路由器，请把细节移到 docs、harness、测试或脚本"
  elif [ "$lines" -gt 150 ]; then
    warn "AGENTS.md 有 $lines 行；建议保持 50-150 行"
  elif [ "$lines" -lt 40 ]; then
    warn "AGENTS.md 只有 $lines 行；请确认包含事实来源、启动流程、硬规则、验证阶梯和完成定义"
  fi
  hard_rules=$(awk '
    /^## 硬性规则/ { in_rules = 1; next }
    /^## / && in_rules { in_rules = 0 }
    in_rules && /^[0-9][0-9]*\./ { count++ }
    END { print count + 0 }
  ' "AGENTS.md")
  if [ "$hard_rules" -gt 15 ]; then
    fail "AGENTS.md 中硬性规则有 $hard_rules 条；请压缩到 15 条以内，并把细节路由到专题文档"
  fi
fi

placeholder_files=$(grep -R -l "{{[A-Z0-9_][A-Z0-9_]*}}" AGENTS.md init.sh docs harness 2>/dev/null || true)
if [ -n "$placeholder_files" ]; then
  warn "仍存在未替换占位符；完成初始化前应替换为项目事实，或明确记录为已知缺口。涉及文件：$(printf '%s' "$placeholder_files" | tr '\n' ' ')"
fi

if command -v python3 >/dev/null 2>&1 && [ -f "harness/feature_list.json" ]; then
  python3 - <<'PY' || failures=$((failures + 1))
import json
import pathlib
import sys

path = pathlib.Path("harness/feature_list.json")
allowed = {"not_started", "active", "blocked", "passing"}
required = {"id", "priority", "area", "title", "behavior", "status", "verification", "evidence", "notes"}

try:
    data = json.loads(path.read_text())
except Exception as exc:
    print(f"失败：{path} 不是合法 JSON：{exc}")
    sys.exit(1)

features = data.get("features")
if not isinstance(features, list):
    print("失败：feature_list.json 必须包含 features 数组")
    sys.exit(1)

active = 0
bad = False
for index, feature in enumerate(features):
    if not isinstance(feature, dict):
        print(f"失败：feature {index} 必须是 object")
        bad = True
        continue
    missing = sorted(required - set(feature))
    if missing:
        print(f"失败：feature {feature.get('id', index)} 缺少字段：{', '.join(missing)}")
        bad = True
    status = feature.get("status")
    if status not in allowed:
        print(f"失败：feature {feature.get('id', index)} 有非法 status：{status!r}，允许值是 {sorted(allowed)}")
        bad = True
    if status == "active":
        active += 1
    verification = feature.get("verification")
    if not verification:
        print(f"失败：feature {feature.get('id', index)} 缺少 verification；每个功能必须有验证命令或手动检查")
        bad = True
    if status == "passing" and not feature.get("evidence"):
        print(f"失败：feature {feature.get('id', index)} 是 passing 但没有 evidence；不能只凭 agent 自信标完成")
        bad = True

if active > 1:
    print(f"失败：feature_list.json 有 {active} 个 active；WIP limit 是 1")
    bad = True

sys.exit(1 if bad else 0)
PY
else
  warn "python3 不可用；跳过 JSON 验证"
fi

if [ -f "harness/session-handoff.md" ]; then
  for heading in "## 仓库状态" "## 当前已验证状态" "## 仍损坏或未验证" "## 清洁状态" "## 下一步最佳动作" "## 命令"; do
    if ! grep -q "$heading" "harness/session-handoff.md"; then
      fail "session-handoff.md 缺少标题：$heading。交接必须覆盖状态、证据、风险、清洁状态和下一步。"
    fi
  done
fi

if [ -d "plans/active" ]; then
  active_plans=$(find "plans/active" -type f | wc -l | tr -d ' ')
  if [ "$active_plans" -gt 1 ]; then
    warn "plans/active 中有 $active_plans 个文件；默认 WIP=1，请确认是否存在过期 active plan"
  fi
fi

if [ "$failures" -gt 0 ]; then
  printf '%s\n' "Harness 检查失败，共 $failures 个问题、$warnings 个警告。"
  exit 1
fi

printf '%s\n' "Harness 检查通过，共 $warnings 个警告。"
