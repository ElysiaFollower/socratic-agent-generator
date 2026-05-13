"""Build hand-calibrated manual-enhance profiles.

The curated curriculum text in this script is derived from manual comparison
against external SEEDRunner reports. It does not copy raw reports into this
repository; it records the profile shape we want the generator to learn from.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from schemas.curriculum import SocraticCurriculum, SocraticStep  # noqa: E402
from schemas.definition import TutorPersona  # noqa: E402
from schemas.profile import Profile  # noqa: E402
from utils.template_assembler import BaseTemplateAssembler  # noqa: E402


OUT_ROOT = ROOT / "docs" / "manual-enhance"
GENERATED_ROOT = OUT_ROOT / "generated"
CALIBRATED_ROOT = OUT_ROOT / "calibrated"
TEMPLATE_PATH = ROOT / "src" / "templates" / "master_prompt_system.jinja2"


def step(
    title: str,
    question: str,
    success: str,
    objective: str,
    hints: list[str],
) -> dict[str, object]:
    return {
        "step_title": title,
        "guiding_question": question,
        "success_criteria": success,
        "learning_objective": objective,
        "scaffolding_hints": hints,
    }


CURRICULA: dict[str, list[dict[str, object]]] = {
    "ARP_Attack": [
        step(
            "环境与身份基线：先确认每个容器是谁",
            "在开始伪造 ARP 之前，你能先证明 A、B、M 的 IP/MAC、网桥和初始 ARP 缓存分别是什么吗？如果这些身份不清楚，后面的“中间人”证据会缺哪一块？",
            "学生能列出 Host A、Host B、Attacker M 的 IP/MAC，说明 `arp -n`、`docker inspect` 或抓包证据中哪些值作为后续投毒前基线。",
            "建立实验身份、网络拓扑和证据基线，避免直接跳进脚本导致无法解释结果。",
            [
                "先区分容器 IP、容器 MAC、宿主网桥接口和攻击脚本运行位置。",
                "观察投毒前 A 对 B、B 对 A 的 ARP 缓存是否已经存在。",
                "记录 M 的 MAC，因为后面所有成功证据都要指向它。",
            ],
        ),
        step(
            "Task 1A：用 ARP request 观察缓存是否被动更新",
            "ARP request 看似是在“询问”，为什么它也可能改变接收方对发送者身份的记忆？",
            "学生能解释 ARP request 中 sender IP/MAC 的作用，并用 `arp -n` 证明确认 Host A 中 B 的 IP 被映射到 M 的 MAC。",
            "理解 ARP 请求包中的 sender 字段如何被接收方学习。",
            [
                "不要只说“发包成功”，要说明接收方更新了哪条缓存项。",
                "比较投毒前后同一个 IP 对应的 MAC。",
                "如果没有变化，先确认目标缓存状态和发送接口是否正确。",
            ],
        ),
        step(
            "Task 1B/1C：比较 ARP reply 与 gratuitous ARP 的差异",
            "如果 reply 和 gratuitous ARP 都能让别人相信“B 在 M 这里”，它们在协议语义和稳定性上有什么不同？",
            "学生能分别说明 ARP reply 与 gratuitous ARP 的字段差异、适用前提，并报告至少一种方式在当前缓存状态下的成功或失败现象。",
            "把三种 ARP 投毒方式从“都会发包”校准为“语义不同、受缓存状态影响不同”的比较实验。",
            [
                "观察 op、psrc、pdst、hwsrc、hwdst 的组合。",
                "先清缓存和不清缓存各测一次，结果可能不同。",
                "把“失败”也当作证据，说明协议实现如何处理 unsolicited ARP。",
            ],
        ),
        step(
            "Task 2 Step 1：维持双向投毒而不是单次投毒",
            "为什么一次性骗过 A 或 B 还不等于真正站到通信中间？持续投毒解决的是哪个动态问题？",
            "学生能在 A 和 B 两端同时看到对方 IP 指向 M 的 MAC，并说明需要循环发送以对抗 ARP 刷新或重新学习。",
            "理解双向 MITM 位置与 ARP 缓存时效性。",
            [
                "单向投毒只改变一个方向的数据路径。",
                "真实通信会触发新的 ARP 学习，单次投毒可能被覆盖。",
                "用两个终端分别观察 A/B 的 ARP 表，而不是只看攻击端日志。",
            ],
        ),
        step(
            "Task 2 Step 2：关闭 IP forwarding 后解释高丢包而非写死 100% 失败",
            "当 M 收到本该转给 B 的包却不转发时，为什么实验现象可能是大量丢包，也可能偶尔仍有回复？",
            "学生能用 ping 序号、丢包率、ARP 缓存刷新或竞态解释关闭 forwarding 后的通信中断/间歇成功，而不是只给出固定的 100% 丢包结论。",
            "把中间人转发开关和真实网络竞态联系起来。",
            [
                "查看 `icmp_seq` 是否连续，丢包率是否稳定。",
                "偶尔 ping 通不一定推翻 MITM，可能说明 ARP 状态被短暂修复。",
                "结合抓包看目标 MAC 是否仍然指向 M。",
            ],
        ),
        step(
            "Task 2 Step 3：开启 IP forwarding 后验证“通信恢复但仍经过 M”",
            "如果通信恢复了，怎样证明 M 不是退出了路径，而是在像路由器一样转发？",
            "学生能用 ping 成功、A/B ARP 表和 M 侧抓包共同说明数据仍经过 M。",
            "理解 MITM 的关键不是断网，而是在不破坏连接的情况下观察或修改流量。",
            [
                "恢复连通性只是第一层证据。",
                "同时保留 ARP 表和 M 侧抓包证据。",
                "解释为什么打开 forwarding 后可以继续做 Telnet 篡改。",
            ],
        ),
        step(
            "Task 2 Step 4：Telnet 篡改要处理原包、改包和校验和",
            "把 Telnet 字符改成固定字符时，如果原包和改包都到达接收方，会出现什么混乱？",
            "学生能说明嗅探、构造替换 payload、重算校验和、抑制或规避原包这四个环节，并用 Telnet 显示结果证明篡改成功。",
            "掌握 TCP payload 篡改的最小闭环，而不是只会写 Scapy 替换字符串。",
            [
                "先确认包方向和端口，再处理 payload。",
                "修改 payload 后 IP/TCP 校验和必须重新生成。",
                "思考为什么替换长度影响 TCP 序列号。",
            ],
        ),
        step(
            "Task 3：Netcat 精确替换与等长约束",
            "为什么 Netcat 中替换一个具体字符串时，比 Telnet 全部替换更需要关注 payload 边界和长度？",
            "学生能完成 Netcat 会话，证明目标字符串被等长替换，并解释为何保持长度能避免序列号级联问题。",
            "从粗粒度篡改推进到应用层内容的可控修改。",
            [
                "先让正常 Netcat 会话跑通。",
                "定位目标字符串是否完整落在同一个 TCP 包里。",
                "用等长替换降低 TCP 流重组复杂度。",
            ],
        ),
    ],
    "LocalDNSAttack": [
        step(
            "DNS 角色图与基线：先弄清谁问谁",
            "用户、local DNS、attacker nameserver、外部权威服务器分别扮演什么角色？如果这个角色图错了，后面 spoof 的源 IP 会错在哪里？",
            "学生能画出查询链路并用 `resolv.conf`、`dig @10.9.0.53`、`rndc dumpdb -cache` 说明初始 DNS 行为。",
            "建立 DNS 攻击中的角色、缓存和证据基线。",
            [
                "先确认用户容器真正使用的 DNS 服务器。",
                "区分直接问 local DNS 和直接问 attacker nameserver。",
                "每轮攻击前都要知道缓存是否干净。",
            ],
        ),
        step(
            "实操前稳定性：接口、延迟和缓存清理",
            "为什么同一个脚本在不同机器上要先找 bridge 接口，并且有时还要给外部链路加延迟？",
            "学生能说明攻击监听接口、`rndc flush`、router 上 netem delay 的目的，并能指出这些步骤缺失时会造成的竞态失败。",
            "把实验中的“准备动作”纳入学习流程，而不是把它们当作脚本细节。",
            [
                "bridge 名称通常不是固定的。",
                "DNS 竞速中，合法响应可能先到。",
                "缓存未清空会让攻击看起来“无效”或无法复现。",
            ],
        ),
        step(
            "Task 1：直接伪造给用户的 DNS answer",
            "如果攻击者只抢答用户的一次查询，为什么成功影响通常只限于这一次？",
            "学生能构造针对 `www.example.com` 的伪造响应，复制 transaction ID 和 question，并让用户看到假 IP。",
            "理解直接响应伪造与 DNS transaction ID、端口和 question 复制的关系。",
            [
                "先监听 user -> local DNS 的查询。",
                "伪造响应源应像 local DNS，而不是像 attacker。",
                "复制 `qd` 和 transaction ID 是让响应被接受的关键。",
            ],
        ),
        step(
            "Task 2：投毒 local DNS 的 answer 缓存",
            "把用户骗一次和把 local DNS 的缓存骗住，攻击影响范围有什么根本区别？",
            "学生能让 local DNS 缓存 `www.example.com` 的假 A 记录，并在停止攻击脚本后仍能查询到污染结果。",
            "理解缓存投毒的持久性和攻击对象从用户到 resolver 的变化。",
            [
                "监听对象变成 local DNS 对外查询。",
                "伪造响应源要像权威服务器。",
                "验证时要停止攻击程序，再查询缓存效果。",
            ],
        ),
        step(
            "Task 3：用 NS 记录接管整个 example.com 域",
            "为什么伪造一个 A 记录只能改一个名字，而伪造 NS 记录会改变后续整个域的解析路径？",
            "学生能在 cache dump 中找到 `example.com` 的伪造 NS 记录，并用其他子域名查询证明流量被导向攻击者 nameserver。",
            "理解 Authority Section 中 NS 记录的影响范围。",
            [
                "区分 Answer Section 的 A 记录和 Authority Section 的 NS 记录。",
                "后续查询如 `mail.example.com` 更能证明域级接管。",
                "攻击者 nameserver 需要能回答该域的后续查询。",
            ],
        ),
        step(
            "Task 4：跨域 NS 投毒失败是 bailiwick 策略的证据",
            "如果一个 example.com 的响应声称 google.com 的 NS 也该改，本地 DNS 为什么不应该轻易相信？",
            "学生能解释并验证 cache 中保留了 in-bailiwick 的记录，而 out-of-bailiwick 记录没有按攻击者预期生效。",
            "把失败结果转化为 DNS 缓存安全策略的理解。",
            [
                "不要把 Task 4 写成“再投毒一个域”。",
                "重点检查 cache dump 中留下了什么、拒绝了什么。",
                "把 google.com 查询结果作为负例证据。",
            ],
        ),
        step(
            "Task 5：Additional Section 不是全盘缓存",
            "同一个伪造响应里塞入多条 Additional 记录时，resolver 为什么只缓存一部分？",
            "学生能说明 Additional Section 中哪些记录被缓存、哪些被拒绝，并用 bailiwick 规则解释差异。",
            "理解 DNS resolver 对附加记录的选择性缓存。",
            [
                "分清 NS 所指向主机的 glue A 记录和无关域名 A 记录。",
                "至少做一次立即 dump 和停止攻击后的查询。",
                "把“没有缓存”作为核心学习结果之一。",
            ],
        ),
    ],
    "RemoteDNSAttack": [
        step(
            "远程 DNS 攻击的前提：固定端口、随机子域和目标域",
            "Kaminsky 攻击为什么不直接反复查询 `www.example.com`，而要制造大量随机子域名？",
            "学生能解释随机子域、固定源端口、transaction ID 猜测空间和目标域 NS 接管之间的关系。",
            "理解远程缓存投毒的攻击模型和实验简化条件。",
            [
                "随机子域避免本地 DNS 直接命中缓存。",
                "实验固定源端口，让主要不确定性变成 transaction ID。",
                "目标不是一个主机名，而是整个域的 NS。",
            ],
        ),
        step(
            "构造 DNS request：让 resolver 必须出门查询",
            "你构造的请求怎样迫使 local DNS 去问外部权威服务器，而不是从本地缓存回答？",
            "学生能生成随机子域查询包，并说明 qname、local DNS 地址和触发查询的路径。",
            "掌握攻击请求包的目的和关键字段。",
            [
                "qname 要属于目标域，但每次随机。",
                "请求发给 local DNS，而不是直接发给权威服务器。",
                "先清 cache，避免误判。",
            ],
        ),
        step(
            "伪造 DNS replies：源地址、端口、ID 和 Authority Section",
            "一批伪造回复中，哪些字段必须看起来像真正的权威回复，哪些字段用于植入后续控制权？",
            "学生能说明 IP.src、UDP.sport、UDP.dport、transaction ID、Answer 和 Authority Section 的作用。",
            "把伪造回复从“发很多包”拆成可检查的协议字段。",
            [
                "源 IP 要伪装成真实权威 nameserver。",
                "ID 是要批量猜测的字段。",
                "Authority Section 的 NS 才是最终接管点。",
            ],
        ),
        step(
            "发起竞速循环：观察概率攻击而不是单次命令",
            "为什么这类攻击的实验流程更像反复尝试和验证，而不是跑一次脚本就结束？",
            "学生能描述 request/reply flood 循环，解释为什么需要大量 transaction ID 猜测，并记录成功前后的验证差异。",
            "理解远程 DNS 投毒中的竞速和概率性。",
            [
                "每轮随机子域会触发一次新的外部查询。",
                "伪造回复必须赶在真实回复前到达。",
                "失败轮次是正常现象，不等同于脚本逻辑错误。",
            ],
        ),
        step(
            "结果验证：证明 resolver 接受了攻击者 NS",
            "攻击成功后，怎样证明 local DNS 后续解析真的转向了攻击者，而不只是一次查询碰巧返回假 IP？",
            "学生能用 `rndc dumpdb -cache` 和后续 `dig` 查询证明目标域 NS 指向攻击者 nameserver。",
            "建立远程 DNS 攻击的完整证据链。",
            [
                "先找 cache 中的 NS 记录。",
                "再查另一个同域主机名验证路径改变。",
                "区分 Answer 中随机子域的 A 记录和 Authority 中域级 NS 记录。",
            ],
        ),
    ],
    "Sniffing_Spoofing": [
        step(
            "环境基线：权限、网桥接口和容器流量路径",
            "为什么抓不到包时，第一反应不该是怀疑 Scapy，而应该先确认权限和接口？",
            "学生能说明 root/非 root 权限差异，找到正确 bridge 接口，并用一次 ICMP 抓包证明监听位置正确。",
            "建立抓包类实验的基础排错顺序。",
            [
                "非 root 运行可能没有抓包权限。",
                "Docker bridge 名称通常需要现场发现。",
                "先抓最简单的 ping，再做过滤器。",
            ],
        ),
        step(
            "Task 1.1A：Scapy 基础 sniff 与权限对照",
            "同一段 sniff 代码，root 和普通用户运行时为什么会有不同结果？",
            "学生能运行 Scapy sniff，记录 root 成功与非 root 失败或受限现象，并解释原因。",
            "理解 libpcap/raw socket 权限与抓包能力。",
            [
                "先用 ICMP 生成可见流量。",
                "对比 root 和 seed 用户输出。",
                "不要把没有输出直接归因于过滤器。",
            ],
        ),
        step(
            "Task 1.1B：BPF 过滤器从现象问题出发",
            "如果你只想看 ICMP、Telnet 或某个子网，过滤器应该表达“什么流量”，而不是表达“我要完成任务”。",
            "学生能分别构造 ICMP、特定源/目的和子网过滤器，并说明每个过滤器为什么只留下目标包。",
            "掌握 BPF 过滤条件和观测目标之间的关系。",
            [
                "先写自然语言条件，再翻译成 BPF。",
                "用主动 ping/telnet 触发流量验证过滤器。",
                "过滤器过窄会造成误以为没流量。",
            ],
        ),
        step(
            "Task 1.2：Scapy 伪造 ICMP 包",
            "伪造一个 ICMP 包时，哪些字段决定它看起来来自另一个主机？",
            "学生能构造并发送 spoofed ICMP Echo Request，并用 tcpdump/抓包说明源地址与真实发送位置不同。",
            "理解 IP 层源地址伪造和链路层实际发送路径。",
            [
                "区分 IP.src 和发送接口。",
                "观察回包是否会回到伪造源。",
                "用抓包证明包确实离开本机。",
            ],
        ),
        step(
            "Task 1.3：Traceroute 是 TTL 控制实验",
            "Traceroute 为什么能逐跳暴露路径？它依赖路由器返回什么错误？",
            "学生能通过逐步增加 TTL 发送探测包，解释 ICMP Time Exceeded 与最终 Echo Reply 的区别。",
            "把 traceroute 从工具使用还原为协议机制。",
            [
                "TTL 每过一跳减一。",
                "TTL 到 0 的路由器会返回 Time Exceeded。",
                "记录每个 TTL 对应的回复来源。",
            ],
        ),
        step(
            "Task 1.4：sniff-and-spoof 要先判断哪些请求该回答",
            "为什么给所有 ICMP request 都伪造回复会误导实验结论？哪些目的地址才应该得到伪造回复？",
            "学生能实现对特定 ICMP Echo Request 的嗅探和伪造回复，并比较局域网不存在地址、外部地址和真实可达地址的不同现象。",
            "理解嗅探触发、伪造响应和真实网络可达性的交互。",
            [
                "先识别 request 的源、目的和 id/seq。",
                "构造 reply 时要交换源目的。",
                "比较 1.2.3.4、LAN 内不存在 IP、8.8.8.8 的现象。",
            ],
        ),
        step(
            "Task 2.1：C/pcap 嗅探程序从编译、接口到过滤器逐层验证",
            "从 Scapy 切到 C/pcap 后，哪些问题从协议问题变成了工程问题？",
            "学生能编译 pcap 程序，选择接口，设置过滤器，并说明抓 Telnet 明文密码的证据边界。",
            "掌握 pcap 程序的开发和验证路径。",
            [
                "先让无过滤抓包跑通，再加 BPF。",
                "处理编译链接参数和权限问题。",
                "Telnet 明文证据要注意方向和 payload 内容。",
            ],
        ),
        step(
            "Task 2.2：C raw socket 伪造与字节序",
            "为什么 C 里伪造包比 Scapy 更容易出错？",
            "学生能说明 IP/ICMP 头字段、校验和、host/network byte order，并发送可抓到的 spoofed ICMP 包。",
            "理解手写 raw packet 的低层细节。",
            [
                "字段长度和字节序是常见错误源。",
                "校验和不能忽略。",
                "抓包对照能定位 header 是否正确。",
            ],
        ),
        step(
            "Task 2.3：C 版 sniff-and-spoof 的完整闭环",
            "当嗅探和伪造都由 C 程序完成时，如何证明程序不是只完成了其中一半？",
            "学生能展示程序捕获请求、构造回复并让 ping 端收到伪造响应的完整证据。",
            "整合 pcap 嗅探、raw socket 发包和协议字段填充。",
            [
                "日志中要有捕获到的 request。",
                "抓包中要有程序发出的 reply。",
                "ping 输出和抓包应能互相印证。",
            ],
        ),
    ],
    "TCP_Attacks": [
        step(
            "环境基线：Telnet、SYN backlog、SYN cookies 和 metrics",
            "如果合法 Telnet 一开始就不稳定，后面怎样判断 SYN flood 是否真的生效？",
            "学生能验证 victim Telnet 服务、记录 `tcp_syncookies` 和 `tcp_max_syn_backlog`，并说明 `ip tcp_metrics` 可能影响复现实验。",
            "建立 TCP 攻击前的状态基线。",
            [
                "先确认 user 能正常 telnet victim。",
                "记录内核防御开关和 backlog 值。",
                "必要时清理 tcp metrics，避免历史缓存干扰。",
            ],
        ),
        step(
            "Task 1.1：Python SYN flood 的真实观察可能偏弱",
            "如果 Python 版本没有立刻压垮服务，这说明攻击无效，还是说明发包效率和系统参数还没形成足够压力？",
            "学生能运行 Python SYN flood，记录 SYN_RECV 数量、Telnet 是否仍可连接，并解释单进程/多进程和 backlog 调整对结果的影响。",
            "把攻击效果与发包效率、队列容量和防御配置关联起来。",
            [
                "不要只看脚本是否运行。",
                "同时观察 SYN_RECV 和合法连接结果。",
                "弱效果本身是重要实验结论。",
            ],
        ),
        step(
            "Task 1.2：C SYN flood 与 Python 版本做对照",
            "同样是伪造 SYN，为什么 C 程序更容易造成持续压制？",
            "学生能编译运行 C SYN flood，对比 Python 版本的连接失败率或队列占用，并解释性能差异。",
            "理解实现效率对 DoS 实验结果的影响。",
            [
                "先恢复和记录 victim 状态。",
                "对照实验要保持 syncookies/backlog 条件一致。",
                "把 C/Python 差异写成实验发现，而不是只给截图。",
            ],
        ),
        step(
            "Task 1.3：SYN cookies 是防御验证，不只是打开开关",
            "开启 SYN cookies 后，攻击流量仍在，为什么合法连接反而能恢复？",
            "学生能在同样攻击压力下开启 SYN cookies，并证明合法 Telnet 可以建立，同时解释半开连接状态保存方式的变化。",
            "理解 SYN cookies 缓解 SYN flood 的机制。",
            [
                "保持攻击脚本运行，再切换防御状态。",
                "观察合法连接是否恢复。",
                "解释 server 为什么不再依赖完整 backlog 状态。",
            ],
        ),
        step(
            "Task 2：TCP RST 攻击要围绕序列号窗口调试",
            "为什么只发一个 RST 包可能时灵时不灵？接收方到底用什么规则决定接受它？",
            "学生能嗅探 Telnet 流量，构造双向或窗口附近的 RST，解释 sequence number 与接收窗口，并复现实验中的连接断开。",
            "理解 TCP RST 注入的窗口条件和不稳定性。",
            [
                "先抓到当前会话的 seq/ack。",
                "尝试 payload 长度修正和小范围序列号探测。",
                "连续成功复现比单次断开更有说服力。",
            ],
        ),
        step(
            "Task 3：TCP 会话劫持先证明可注入，再谈命令效果",
            "劫持 Telnet 会话时，什么证据能说明命令是攻击者注入的，而不是用户自己输入的？",
            "学生能构造带正确 seq/ack 的 payload 注入包，并用 victim 端结果证明命令执行。",
            "掌握 TCP 会话劫持中的方向、序列号和 payload 构造。",
            [
                "明确攻击的是 user -> victim 方向还是反向。",
                "payload 要符合 Telnet shell 交互语义。",
                "结果证据应来自 victim，而不仅是发包脚本日志。",
            ],
        ),
        step(
            "Task 4：Reverse shell 是会话劫持的组合验证",
            "如果注入的是反弹 shell 命令，哪些网络连接和文件/命令结果能证明攻击链完成？",
            "学生能让 victim 向 attacker 建立 shell 连接，并说明监听端、注入命令、victim 结果三者的对应关系。",
            "把会话劫持扩展为可交互控制链路，同时保持安全边界。",
            [
                "先让 attacker 监听端口。",
                "注入命令要考虑 shell 重定向语法。",
                "用 victim 文件创建或命令输出证明 shell 权限。",
            ],
        ),
    ],
    "VPN_Tunnel": [
        step(
            "拓扑和路由基线：先证明哪些网段天然不通",
            "在写 TUN 程序前，你能解释 client、server-router、host V 分别在哪些网段，以及为什么 client 还不能直接到 192.168.60.5 吗？",
            "学生能列出容器 IP、关键路由和基线 ping 结果，说明哪些路径通、哪些路径不通。",
            "建立 VPN 实验的网络拓扑和路由问题意识。",
            [
                "分别看 client、server-router、host V 的 `ip route`。",
                "对比 client->server、公网侧和 server->hostV 私网侧连通性。",
                "失败 ping 是后续隧道价值的证据。",
            ],
        ),
        step(
            "Task 2a/2b：创建 TUN 并让内核认识它",
            "TUN 设备只是一个文件描述符时，为什么还不能承载目标网段的流量？",
            "学生能创建指定名称的 TUN 接口，配置地址并启用接口，解释接口名、地址和 route 的作用。",
            "理解 TUN 作为三层虚拟接口与 Linux 路由表的关系。",
            [
                "先只打印接口名，确认程序拿到了 TUN。",
                "再配置 IP 和 up 状态。",
                "检查路由表中是否出现 TUN 网段。",
            ],
        ),
        step(
            "Task 2c：从 TUN 读包就是观察路由决策",
            "为什么 ping 192.168.53.8 会从 TUN 读到包，而 ping 192.168.60.5 一开始读不到？",
            "学生能用两个目标地址对照说明哪些包被路由进 TUN，哪些没有，并解释路由规则导致的差异。",
            "把 TUN 读取现象和路由表连接起来。",
            [
                "先查 `ip route get <target>`。",
                "观察程序打印的内层 IP 包摘要。",
                "没有读到包通常是路由没有导入 TUN。",
            ],
        ),
        step(
            "Task 2d：写回 TUN 的必须是合法 IP 包",
            "为什么向 TUN 写垃圾字节不会得到正常网络响应，而写合法 ICMP reply 可以影响 ping？",
            "学生能构造合法回包与垃圾写入对照，说明内核只按 IP 包语义处理 TUN 输入。",
            "理解 TUN 的三层语义和内核协议栈边界。",
            [
                "TUN 读写的单位是 IP packet。",
                "合法回包要交换源/目的并设置合理字段。",
                "垃圾写入的失败也是接口语义证据。",
            ],
        ),
        step(
            "Task 3：Client 端封装不是 VPN 完成，只是把内层包送到 server",
            "把 TUN 读到的 IP 包包进 UDP 发出去后，为什么目标私网仍不一定能收到？",
            "学生能实现 client->server 的 UDP 封装，抓到 server 收到的内层包，并说明这只是单向用户态传输。",
            "理解内层 IP 包与外层 UDP 隧道的分层。",
            [
                "记录外层 UDP 的源/目的。",
                "在 server 端打印内层 IP 摘要。",
                "不要把 server 收到 UDP 误认为 host V 已收到。",
            ],
        ),
        step(
            "Task 4：Server 写回 TUN 才进入内核转发路径",
            "Server 收到内层 IP 包后，为什么必须写入自己的 TUN，才能让 Linux 替你转发到私网？",
            "学生能实现 socket->TUN 分支，并用 host V 抓包或 ping 现象证明内层包进入私网。",
            "理解 VPN server 用户态程序和内核转发之间的交接点。",
            [
                "server 端 TUN 要配置在合适网段。",
                "写入 TUN 后还依赖 server-router 的转发和路由。",
                "host V 侧抓包比 client ping 更能证明包到了私网。",
            ],
        ),
        step(
            "Task 5：双向隧道的核心是同时监视 TUN 和 UDP socket",
            "为什么单向路径打通后 Telnet 仍不能正常工作？回包应该从哪里回来？",
            "学生能用 `select()` 或等价机制处理 TUN->UDP 与 UDP->TUN 两个方向，并证明 ping/Telnet 双向可用。",
            "建立完整 VPN 数据平面的双向模型。",
            [
                "请求方向和响应方向经过不同分支。",
                "两个文件描述符都要持续监听。",
                "用 tcpdump 区分外层 UDP 和内层 ICMP/TCP。",
            ],
        ),
        step(
            "Task 6：隧道中断实验用于理解有状态会话的恢复边界",
            "隧道断开再恢复时，ICMP 和 TCP 会话的表现为什么可能不同？",
            "学生能记录中断前、中断中、恢复后的通信表现，并解释丢包、超时和会话状态之间的关系。",
            "理解隧道可用性对上层协议的影响。",
            [
                "选择一个持续交互的 TCP/echo 场景。",
                "分别保留三个时间点的输出。",
                "区分隧道恢复和原 TCP 会话恢复。",
            ],
        ),
        step(
            "Task 7/8：回程路由和站点到站点 VPN 是路由问题",
            "为什么 Host V 的默认路由会决定隧道是否看起来“单向成功”？站点到站点场景又多了哪些网段决策？",
            "学生能修改或解释 Host V 回程路由，并在双私网拓扑中说明哪些前缀必须进入隧道。",
            "把后半实验的重点从代码转向路由策略。",
            [
                "回包不走 VPN server，client 就收不到。",
                "更具体路由可以覆盖默认路由。",
                "站点到站点 VPN 要为两侧私网都设计路由。",
            ],
        ),
        step(
            "Task 9：TAP 对照 TUN，理解二层和三层边界",
            "如果 TUN 处理的是 IP 包，TAP 处理的又是什么？这会怎样改变 ARP、以太帧和接口配置？",
            "学生能完成 TAP 实验对照，说明 TAP 读写以太帧、TUN 读写 IP 包，并解释为什么要避免旧 TUN 路由干扰。",
            "通过 TAP 对照巩固虚拟网络接口层次。",
            [
                "做 TAP 前清理仍占用路由的 TUN 程序。",
                "观察 TAP 中的以太网帧和 ARP。",
                "用层次差异解释配置和抓包内容差异。",
            ],
        ),
    ],
}


MISMATCHES = [
    {
        "pattern": "环境摩擦被省略",
        "labs": ["LocalDNSAttack", "Sniffing_Spoofing", "TCP_Attacks", "VPN_Tunnel"],
        "generator_symptom": "初始节点经常从任务本体开始，弱化 bridge 接口发现、Docker compose 差异、cache flush、路由基线等准备动作。",
        "manual_fix": "把环境身份、接口、缓存、路由和服务基线提升为显式第一节点或第二节点。",
    },
    {
        "pattern": "成功标准过度确定",
        "labs": ["ARP_Attack", "TCP_Attacks", "RemoteDNSAttack"],
        "generator_symptom": "初稿容易写成 100% 丢包、一次脚本成功或固定结果。",
        "manual_fix": "成功标准允许高丢包/间歇成功、概率竞速、多次复现和负例解释。",
    },
    {
        "pattern": "负例和失败实验没有被当作学习节点",
        "labs": ["LocalDNSAttack", "VPN_Tunnel", "TCP_Attacks"],
        "generator_symptom": "初稿偏向正向完成任务，忽略 cross-domain NS 不被缓存、垃圾写入 TUN 无效、Python SYN flood 效果弱等关键感受。",
        "manual_fix": "把负例结果作为解释安全策略、接口语义和系统参数的核心节点。",
    },
    {
        "pattern": "证据链不足",
        "labs": ["ARP_Attack", "LocalDNSAttack", "Sniffing_Spoofing", "VPN_Tunnel"],
        "generator_symptom": "节点常只要求学生“完成攻击”，没有要求保存 ARP 表、cache dump、tcpdump、ping 序号或 victim 侧结果。",
        "manual_fix": "每个节点 success_criteria 都绑定可观察证据和解释义务。",
    },
    {
        "pattern": "任务粒度不贴合真实认知负担",
        "labs": ["VPN_Tunnel", "Sniffing_Spoofing", "LocalDNSAttack"],
        "generator_symptom": "复杂任务被压成一个大节点，或把相近原语拆得过碎但没有比较问题。",
        "manual_fix": "按真实报告中的卡点拆分：TUN 创建/读/写、DNS 角色/稳定性/各 section 策略、Scapy 到 C 的工程切换。",
    },
    {
        "pattern": "源文档编号问题未被校正",
        "labs": ["TCP_Attacks"],
        "generator_symptom": "TCP 官方手册中 Task 3 标题复用，初稿容易遗漏 video RST 或混淆 session hijacking 顺序。",
        "manual_fix": "以真实报告完成路径为准，保留 RST、session hijacking、reverse shell 的连续学习线；未由报告充分支撑的 video RST 不作为核心节点。",
    },
]


def load_persona(lab_id: str) -> TutorPersona:
    path = GENERATED_ROOT / lab_id / "definition.json"
    return TutorPersona.model_validate_json(path.read_text(encoding="utf-8"))


def write_json(path: Path, data: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def build_profiles() -> list[dict[str, object]]:
    template = TEMPLATE_PATH.read_text(encoding="utf-8")
    assembler = BaseTemplateAssembler(template)
    summaries = []

    for lab_id, raw_steps in CURRICULA.items():
        persona = load_persona(lab_id)
        curriculum = SocraticCurriculum.model_validate(
            [SocraticStep.model_validate(item) for item in raw_steps]
        )
        prompt = assembler.assemble(persona, curriculum)
        profile = Profile(
            profile_name=f"{lab_id} manual calibrated",
            topic_name=persona.topic_name,
            lab_name=lab_id,
            persona_hints=persona.persona_hints,
            target_audience=persona.target_audience,
            curriculum=curriculum,
            prompt_template=prompt,
        )
        lab_dir = CALIBRATED_ROOT / lab_id
        write_json(lab_dir / "curriculum.json", curriculum.model_dump())
        write_json(lab_dir / "profile.json", profile.model_dump())
        summaries.append(
            {
                "lab_id": lab_id,
                "profile": str((lab_dir / "profile.json").relative_to(ROOT)),
                "curriculum": str((lab_dir / "curriculum.json").relative_to(ROOT)),
                "topic_name": profile.topic_name,
                "step_count": curriculum.get_len(),
                "steps": [item["step_title"] for item in raw_steps],
            }
        )

    write_json(OUT_ROOT / "calibrated-profile-summary.json", summaries)
    write_json(OUT_ROOT / "mismatch-taxonomy.json", MISMATCHES)
    return summaries


if __name__ == "__main__":
    for summary in build_profiles():
        print(f"{summary['lab_id']}: {summary['step_count']} steps")
