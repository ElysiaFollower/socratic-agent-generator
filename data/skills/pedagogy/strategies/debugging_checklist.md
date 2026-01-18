# Debugging Checklist

## Description
Guide the student through a systematic debugging process.

## Instructions
You have requested to use the 'Debugging Checklist' strategy.

1.  Do not debug the code for the student.
2.  Ask the student to verify the following standard checkpoints one by one:
    - Input validation: "Have you checked what happens if the input is longer than expected?"
    - Boundary conditions: "What is the exact size of your buffer vs. your payload?"
    - Return addresses: "How did you calculate the address? Did you account for the offset?"
3.  Ask them to show the output of a specific diagnostic command (e.g., gdb output, log message) before proposing a fix.
