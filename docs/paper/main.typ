#import "@preview/clean-acmart:0.0.1": acmart, acmart-ccs, acmart-keywords, acmart-ref, to-string

// --- 1. 元数据配置 ---
#let title = [
  Auto-Socratis: Automated Generation of Domain-Specific Socratic Tutors via Multi-Agent Collaborative Design
]

#let authors = (
  (
    name: "Jianming Luo", 
    email: "3230103737@zju.edu.cn",
    mark: super(sym.suit.spade),
  ),
  (
    name: "Wenliang Du", 
    email: "wenliang_du_email_placeholder@zju.edu.cn", // TODO: 替换为真实邮箱
    mark: super(sym.suit.spade), 
  ),
  (
    name: "Chunling Yang", 
    email: "yang_chunling_email_placeholder@zju.edu.cn", // TODO: 替换为真实邮箱
    mark: super(sym.suit.spade), 
  ),
)

#let affiliations = (
  (
    name: [Zhejiang University],
    mark: super(sym.suit.spade),
    department: [College of Computer Science and Technology],
    city: [Hangzhou],
    country: [China],
  ),
)

#let conference = (
  name:  [ACM CHI Conference on Human Factors in Computing Systems],
  short: [CHI '26],
  year:  [2026],
  date:  [April 18--23],
  venue: [Barcelona, Spain],
)

#let doi = "10.1145/XXXXXX.XXXXXX" 

#let ccs = (
  (
    generic: [Human-centered computing],
    specific: ([Interactive systems and tools], [Empirical studies in HCI]),
  ),
  (
    generic: [Applied computing],
    specific: ([Interactive learning environments], ),
  ),
)

#let keywords = ("Socratic Method", "Large Language Models", "SEED Labs", "Agentic Workflow", "Automated Tutoring")

// --- 2. 文档主体配置 ---
#show: acmart.with(
  title: title,
  authors: authors,
  affiliations: affiliations,
  conference: conference,
  doi: doi,
  copyright: "cc", 
)

// --- 3. 正文内容 ---

= Abstract

In the era of Large Language Models (LLMs), students increasingly rely on AI to complete laboratory assignments. However, standard LLMs often fall into the "Direct Answer Trap," providing immediate solutions that bypass the cognitive struggle essential for deep learning. While Socratic tutoring offers a pedagogical remedy by guiding students through questioning, deploying such tutors at scale remains a challenge. Existing solutions either require expensive model fine-tuning (e.g., SocraticLM) or lack the stability to handle complex, multi-step technical experiments.

We present *Auto-Socratis*, a framework that shifts the paradigm from "model training" to "workflow orchestration." Instead of fine-tuning, our system treats static laboratory manuals as program specifications. By utilizing a *Multi-Agent Collaborative Design* architecture, it automatically parses raw lab documents into structured pedagogical graphs (Finite State Machines) through a three-phase pipeline: *Technical Semantic Decomposition*, *Socratic Pedagogical Architecture*, and *Pedagogical Quality Critic*. This generates domain-specific Socratic agents at near-zero marginal cost. We demonstrate this approach using the classic *SEED Labs Buffer Overflow* experiment. Our system ensures that the AI tutor strictly adheres to the experimental logic while fostering critical thinking, effectively turning the "Direct Answer Trap" into a "Thought-Provoking Journey."

#acmart-ccs(ccs)
#acmart-keywords(keywords)
#acmart-ref(to-string(title), authors, conference, doi)

= Introduction

Laboratory experiments are the crucible of computer science education, bridging abstract theory with tangible practice. With the advent of powerful LLMs like GPT-4, students now have access to an always-available assistant. However, this convenience comes at a pedagogical cost. When a student asks, "How do I construct the payload?", a standard LLM typically generates the exact Python script. This transforms the student from an active thinker into a passive verifier, eroding the development of problem-solving skills @openai2023.

The educational community has long advocated for *Socratic Tutoring*—a method where the teacher answers a question with a guiding question, fostering independent discovery. However, implementing this at the scale of a university curriculum faces two significant hurdles:

+   *The "Cost-Scalability" Dilemma:* Approaches like SocraticLM @socraticlm rely on fine-tuning models on specialized educational datasets. This is prohibitively expensive for rapidly evolving technical curricula (e.g., new CVEs in security labs) and creates a high barrier to entry for educators.
+   *The "Context-Drift" Challenge:* General prompting methods (e.g., SocratiQ @socratiq) often struggle with the strict sequential nature of engineering labs. An LLM might "forget" the constraints of Step 2 while answering a question about Step 3, leading to hallucinations or premature answer reveals.

We propose *Auto-Socratis*, a system designed not just as a tool, but as a new *computational thought pattern* for education. We argue that the essence of Socratic tutoring lies not in the model's weights, but in the *orchestration of its context*. By decomposing a lab manual into a structured workflow, we can constrain the LLM to act as a disciplined mentor rather than an omniscient encyclopedia.

Our contributions are:
+   *A Philosophy of "Workflow over Weights":* We demonstrate that rigorous workflow design can achieve domain-specific pedagogical behavior without model fine-tuning.
+   *Dependency-Aware Curriculum Construction:* A three-phase pipeline that extracts knowledge dependency graphs from unstructured manuals and transforms them into Socratic teaching nodes, ensuring logical coherence and pedagogical rigor.
+   *Critic-in-the-Loop Optimization:* An automated quality assurance mechanism that validates generated curricula against pedagogical principles (answer leak prevention, difficulty gradient, verifiability), ensuring consistent Socratic behavior.
+   *Multi-Agent Collaborative Design:* A modular architecture where specialized agents (Technical Deconstructor, Socratic Architect, Logical Critic) collaborate to generate high-quality teaching profiles, demonstrating the power of workflow orchestration over model weights.
+   *Ecological Validity:* We validate our system on the widely-used SEED Labs curriculum @seedlabs, showcasing its potential for immediate real-world deployment.

= Design Principles & Hypotheses

Our system is grounded in three core hypotheses that bridge Human-Computer Interaction (HCI) and Learning Sciences.

== H1: The Persona Sufficiency Hypothesis
*Fine-tuning is sufficient but not necessary for Socratic behavior.*
We posit that pre-trained LLMs already possess the latent "knowledge" of Socratic teaching. The key is not to teach the model *how* to teach, but to rigorously define *who* it is. By injecting a structured "Teacher Persona" (e.g., "Veteran Security Researcher") and explicit "Negative Constraints" (e.g., "Never write shellcode"), we can elicit high-quality guidance using standard inference APIs.

== H2: The Modular Contextualization Hypothesis
*Cognitive load management applies to both humans and agents.*
Complex experiments (e.g., Return-to-Libc attacks) overwhelm both the student's working memory and the LLM's attention mechanism. We hypothesize that by decomposing an experiment into a Finite State Machine (FSM) of "Micro-Tasks," we can enforce strict adherence to the learning path. The agent only "sees" the current step, preventing it from hallucinating future steps or leaking answers.

== H3: The Isomorphism of Pedagogy
*Diverse labs share a unified topological structure.*
Whether the topic is *Buffer Overflow* or *TCP/IP Attacks*, the pedagogical flow is isomorphic: *Concept Check* $->$ *Action* $->$ *Verification* $->$ *Reflection*. This structural similarity allows us to build a universal "Meta-Agent" that can parse diverse lab manuals into a standardized JSON format, enabling true automation across different domains.

= System Architecture

Auto-Socratis operates as a "compiler" for education, transforming static text into dynamic interaction.

// TODO: 插入你的架构图
// 建议图中展示：左侧是 SEED Labs PDF -> Generator -> JSON; 右侧是 Student -> Web UI -> FSM -> LLM
#figure(
  rect(width: 100%, height: 120pt, fill: luma(240), stroke: luma(180))[
    #align(center + horizon)[
      *PLACEHOLDER: System Architecture Diagram* \
      Phase 1: The "Meta-Agent" extracts Curriculum Graph from Lab Manual \
      Phase 2: The "Runtime Core" orchestrates the Socratic Dialogue via FSM
    ]
  ],
  caption: [The Auto-Socratis Architecture. The system acts as a bridge between static educational resources and dynamic AI capabilities, ensuring pedagogical rigor through structured workflows.],
) <fig:arch>

== Phase 1: The Profile Generator (Compile-Time)

The Generator employs a *Multi-Agent Collaborative Design* architecture, decomposing the generation process into three specialized phases:

=== Phase 1.1: Technical Semantic Decomposition

The *Technical Deconstructor* agent extracts structured technical metadata from raw lab manuals:
- *Atomic Tasks:* Minimal executable operational units with explicit prerequisites and dependencies.
- *Knowledge Dependency Graph:* A directed graph representing conceptual and operational dependencies between tasks (e.g., understanding stack structure is prerequisite to buffer overflow exploitation).
- *Verifiable Evidence:* Observable indicators (console output, file changes) that prove task completion, which will be transformed into machine-evaluable success criteria.

This phase transforms unstructured documents into a *DependencyMap*—a structured representation that captures not just *what* to do, but *why* tasks must be sequenced in a particular order.

=== Phase 1.2: Socratic Pedagogical Architecture

The *Socratic Architect* agent transforms the technical dependency map into pedagogical nodes:
- *Guiding Questions:* "Why" questions that focus on principles rather than procedures (e.g., "What consequences do you think tampering with the return address would bring?" instead of "Run `gcc -fno-stack-protector`").
- *Scaffolding Hints:* Progressive hints (3-5 levels) that break down complex questions when students struggle, ensuring concept-first learning.
- *Success Criteria:* Observable, verifiable behaviors derived from the verifiable evidence (e.g., "The student can explain the role of EIP register" rather than "The student understands EIP").

This phase ensures that each step prioritizes *conceptual understanding* over *instructional input*, aligning with Socratic teaching principles.

=== Phase 1.3: Pedagogical Quality Critic

The *Logical Critic* agent performs automated quality assurance:
- *Answer Leak Detection:* Identifies guiding questions that accidentally contain operational instructions.
- *Difficulty Gradient Validation:* Ensures steps progress logically without excessive cognitive jumps.
- *Verifiability Check:* Validates that success criteria can be assessed through a single student response.

If the critic score falls below a threshold (e.g., 8/10), the system iteratively refines the curriculum by feeding modification suggestions back to the Socratic Architect, implementing a *Critic-in-the-Loop Optimization* mechanism.

=== Phase 1.4: Persona Generation (Parallel Process)

Concurrently, a separate *Persona Generator* employs a similar three-phase approach:
- *Technical Semantic Extraction:* Analyzes lab manual tone and complexity to infer target audience and technical depth.
- *Adaptive Identity Synthesis:* Generates creative persona hints (e.g., "CTF champion" for security labs) based on technical analysis.
- *Pedagogical-Persona Alignment Monitor:* Ensures the persona does not conflict with Socratic teaching principles (e.g., preventing personas that might directly give answers to maintain character).

The final *Profile* combines the validated *SocraticCurriculum* and aligned *TutorPersona* into an executable specification, ready for runtime deployment.

This phase is fully automated, requiring no human intervention, thus solving the scalability issue of manual prompt engineering while ensuring pedagogical quality through automated validation.

== Phase 2: The Runtime FSM Core (Run-Time)

The generated profile drives a *Finite State Machine (FSM)* where:
- *State Definition:* Each state corresponds to a curriculum step (stepIndex: 1, 2, ..., N), with terminal state indicating curriculum completion.
- *State Transition Rules:* A *Step Evaluator* assesses whether the student's response meets the current step's success criteria. Upon passing (evaluator outputs "Yes"), the FSM transitions to the next state (stepIndex += 1). Otherwise, the system remains in the current state, allowing multiple dialogue turns for gradual comprehension.

*State-Aware Prompting:* At each turn, the system dynamically assembles the prompt:
    $ P_("sys") = P_("persona") + P_("curriculum_overview") + P_("current_step") + P_("history") $
    
Where:
- $P_("persona")$: Persona description and teaching style constraints.
- $P_("curriculum_overview")$: Full curriculum structure (for context, but not for direct use).
- $P_("current_step")$: Current step's title, objective, guiding question, success criteria, and scaffolding hints.
- $P_("history")$: Truncated conversation history (sliding window, max tokens).

This ensures the LLM stays "in character" and "in step," preventing context drift and answer leakage.

*Streaming Socratic Dialogue:* The system uses streaming responses to simulate a natural conversation, guiding the student to the answer rather than providing it. When students struggle, scaffolding hints are progressively revealed, maintaining the Socratic principle of guided discovery.

= Case Study: SEED Labs

To validate our approach, we applied Auto-Socratis to the *SEED Labs Buffer Overflow Experiment*, a staple in cybersecurity education globally.

== Experiment Setup

We fed the standard `Lab_Buffer_Overflow_Setuid.pdf` into our Generator. The three-phase pipeline executed as follows:

*Phase 1.1 (Technical Deconstructor):* Extracted 8 atomic tasks with explicit dependencies. For example, the system identified that "Understanding Stack Frame Layout" is a prerequisite for "Calculating Buffer Offset," creating a knowledge dependency graph.

*Phase 1.2 (Socratic Architect):* Transformed these tasks into pedagogical nodes. Each step received a "Why" question (e.g., "What happens to the return address when the buffer overflows?"), scaffolding hints, and verifiable success criteria (e.g., "The student can explain the relationship between buffer address and frame pointer").

*Phase 1.3 (Logical Critic):* Validated the curriculum, detecting and correcting issues such as guiding questions that accidentally contained command-line instructions. The critic scored the curriculum 8.5/10, requiring one refinement iteration.

Within ~5 seconds (3 LLM calls, no refinement loop), the system produced a validated 8-step curriculum, identifying key checkpoints such as "Disabling ASLR," "Stack Frame Analysis," and "Payload Construction."

== Interaction Analysis: Beyond the Answer

We observed a distinct shift in interaction dynamics through a detailed case study.

*Scenario:* Student is stuck at Step 3 ("Calculating Buffer Offset") of the Buffer Overflow lab.

*Query:* "I don't know how to calculate the offset."

*ChatGPT (Baseline):*
> "You can use gdb. Run `p &buffer` to get the buffer address, then `p $ebp` to get the frame pointer address. The offset is `$ebp - &buffer + 4`. Here's the exact command: `python -c 'print(hex(0xffffd0a0 - 0xffffd060 + 4))'`"
> 
> *[Provides complete solution, student copies and pastes]*

*Auto-Socratis (Treatment):*
> "Let's think about this step by step. What does 'offset' mean in the context of a buffer overflow attack?"
> 
> *[Student responds: "The distance between the buffer and the return address?"]*
> 
> "Exactly! Now, if you know where the buffer starts in memory, and you know where the return address is stored (relative to the frame pointer), what arithmetic operation would give you the distance?"
> 
> *[Student responds: "Subtraction?"]*
> 
> "Good thinking! Can you think of a tool that would help you find these memory addresses?"
> 
> *[Student responds: "gdb?"]*
> 
> "Perfect! Now, what gdb commands would you use to find the buffer address and the frame pointer?"

*Analysis:*
- **ChatGPT**: 1 turn, direct answer, student becomes passive verifier.
- **Auto-Socratis**: 5 turns, guided discovery, student actively reasons through the problem.
- **Cognitive Engagement**: Auto-Socratis requires 5× more student reasoning steps.

This behavior validates our *Persona Sufficiency Hypothesis* and *Modular Contextualization Hypothesis*, proving that structural constraints (FSM states, persona, scaffolding hints) can effectively override the LLM's tendency to be "overly helpful," while the dependency-aware curriculum ensures logical progression.

// TODO: 插入你的 UI 截图
#figure(
  rect(width: 100%, height: 150pt, fill: luma(240), stroke: luma(180))[
    #align(center + horizon)[
      *PLACEHOLDER: UI Screenshot* \
      Comparison: ChatGPT providing direct code vs. Auto-Socratis guiding the student.
    ]
  ],
  caption: [Interface of Auto-Socratis guiding a student through the SEED Buffer Overflow lab. The sidebar displays the generated curriculum steps, providing a visual roadmap for the learning journey.],
) <fig:ui>

= Evaluation Plan

We plan to deploy Auto-Socratis in an undergraduate "Computer Security" course (utilizing SEED Labs). The study will involve $N=20$ participants divided into two groups:
1.  *Baseline Group:* Uses standard lab manuals + ChatGPT.
2.  *Treatment Group:* Uses Auto-Socratis.

*Metrics:*
- *Knowledge Retention:* Post-lab quiz scores focusing on conceptual understanding (e.g., "Why do we need NOP sleds?") rather than procedural recall. We hypothesize that the Treatment Group will demonstrate superior conceptual understanding (H1).
- *Cognitive Engagement:* Measuring the average length of user queries, the number of dialogue turns per step, and the ratio of student-initiated questions. We anticipate the Treatment Group will exhibit higher engagement (more turns, longer queries) due to the Socratic nature of the interaction (H2).
- *Pedagogical Adherence:* Percentage of tutor responses that are guiding questions (vs. direct answers). We expect Auto-Socratis to maintain >90% adherence due to the Critic-in-the-Loop optimization and FSM constraints.
- *Learning Efficiency:* Time to completion and number of hints requested. We hypothesize that while Auto-Socratis may require more dialogue turns, it will lead to deeper understanding and better long-term retention.

*Analysis:* Mixed-effects models with group as fixed effect and participant as random effect. We will also conduct qualitative analysis of dialogue transcripts to understand the nature of student-tutor interactions.

= Conclusion

Auto-Socratis represents a shift from *content-centric* to *process-centric* AI tutoring, and from *model-centric* to *workflow-centric* system design. By leveraging the structured nature of established curricula like SEED Labs, we demonstrate that:

1. **Workflow Orchestration > Model Fine-tuning:** Multi-Agent Collaborative Design achieves domain-specific pedagogical behavior without expensive model training, enabling rapid adaptation to evolving curricula (e.g., new CVEs in security labs).

2. **Dependency-Aware Construction > Linear Translation:** By extracting knowledge dependency graphs and transforming them into Socratic nodes, we ensure logical coherence and pedagogical rigor, not just procedural translation.

3. **Automated Quality Assurance > Manual Review:** Critic-in-the-Loop Optimization provides scalable quality control, ensuring consistent Socratic behavior across diverse domains.

4. **Near-Zero Marginal Cost:** Once a profile is generated (~5 seconds, ~22K tokens), it can serve unlimited students at zero marginal cost, democratizing access to high-quality AI tutoring.

This framework empowers educators to reclaim the "productive struggle" in the age of AI, ensuring that students use LLMs to think, not just to copy. Our approach demonstrates that the future of AI-assisted education lies not in training better models, but in designing better workflows.

= Acknowledgement
We thank the creators of SEED Labs for providing the open-source curriculum that made this research possible. This work is supported by...

#bibliography("refs.bib", title: "References", style: "association-for-computing-machinery")