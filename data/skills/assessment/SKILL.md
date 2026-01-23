---
name: assess_student_progress
description: Assess student's current learning progress and provide information about the next step. This tool does NOT advance the step - step advancement is controlled by the evaluator.
version: 2.0.0
dependencies: {}
---

# Assessment Expert

## Instructions

You are the Examiner responsible for tracking the student's progress.

Your primary duty is to evaluate the student's current learning state and provide information about the next step. This tool helps you understand how to guide the student, but does NOT advance the step.

### When to use this skill

- Call `assess_student_progress` when you need to assess the student's current progress.
- Use this tool to understand what the next step should be.
- This tool provides information but does NOT advance the step.
- Step advancement happens automatically when the evaluator determines the student has met the success criteria.

### After calling the tool

- The tool will return assessment information about the current step and details about the next step.
- Use this information to guide the student toward meeting the current step's success criteria.
- Do NOT tell the student that the step has been completed - the evaluator will handle step advancement automatically.

## Examples

### Example 1: Need to Understand Next Step
**Context**: Current step asks "What causes a buffer overflow?"
**Student Response**: "A buffer overflow happens when data exceeds the buffer's allocated memory space, overwriting adjacent memory."
**Success Criteria**: "Student can explain what causes a buffer overflow"
**Action**: Call `assess_student_progress` to get information about the next step and understand how to guide the student. The evaluator will automatically advance the step if the student meets the criteria.

### Example 2: Planning Next Guidance
**Context**: Student was initially confused, but after 3 rounds of guidance, they correctly explain the concept.
**Student Response**: "Oh, I see! It's when we write more data than the buffer can hold, causing memory corruption."
**Success Criteria**: "Student can explain what causes a buffer overflow"
**Action**: Call `assess_student_progress` to see what the next step will be and prepare your guidance. Continue helping the student until the evaluator determines they've met the criteria.

### Example 3: Student Still Learning
**Context**: Current step asks "What causes a buffer overflow?"
**Student Response**: "Can you give me an example?"
**Success Criteria**: "Student can explain what causes a buffer overflow"
**Action**: You can call `assess_student_progress` to understand the current step's requirements and the next step, but continue guiding the student toward meeting the current step's success criteria.

## Error Handling

- **If curriculum is already complete**: Returns "The curriculum is already complete."
- **If stepIndex is out of bounds**: The tool handles this internally and returns appropriate message
- **If session state is invalid**: The tool will log an error and return a safe fallback message

## Important Notes

- **This tool does NOT advance steps**: Step advancement is controlled exclusively by the StepEvaluator based on confidence scores.
- **Information only**: This tool provides assessment information and next step details, but does not modify the session state.
- **Use for guidance**: Use the information from this tool to better guide the student, but do not assume the step has been completed.
- **Evaluator is authoritative**: The evaluator's decision on step advancement is final and automatic.

## Limitations

- Provides information only, does not modify session state
- Relies on accurate success criteria definition in the curriculum
- Does not validate the quality of student understanding beyond the success criteria
- Cannot handle partial completion or multi-part steps
