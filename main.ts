import fs from "fs";
import { TM, Transition, NTransition } from "./adt";
const args = Bun.argv.slice(2, Bun.argv.length);

const tm = new TM(args[0] == undefined ? "" : args[0]);

const getTransitions = (program: string): Transition[] => {
  const transitions = new Map<string, NTransition[]>();

  let lines = program.split("\n").filter((line) => line.length != 0);

  let isInStateBlock = false;
  let stateBlockIndentLevel: number;
  let stateBlockValue = "";
  let isInReadBlock = false;
  let readBlockIndentLevel: number;
  let readBlockValue = "";

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].split("");
    let isInComment = false;

    for (let j = 0; j < line.length; j++) {
      // Removes all comments
      if (
        isInComment ||
        line[j - 1] == ":" ||
        (isInComment && line[j] == ")") ||
        (line[j] == "(" && (line[j - 1] == undefined || line[j - 1] == " "))
      ) {
        line[j] = "";
        isInComment = true;
      }
      if (line[j] == ")" && isInComment) {
        isInComment = false;
      }
    }

    lines[i] = line.join("");
  }

  program = lines.join("\n");

  let tokens: string[] =
    program.match(
      /(^ +)| {2,}(?=[\w*!])|\r?\n|->|\([^) ]\)|:|[\w*!]+(?:[-_][\w*!]+)*|[-_!]/gm,
    ) ?? [];

  tokens = tokens.flatMap((t) => (t === "else" ? ["read", "*"] : [t]));

  let indentLevel = 0;

  for (let j = 0; j < tokens.length; j++) {
    // Find the right amount of indentation
    if (/^ +$/.test(tokens[j])) {
      indentLevel = tokens[j].length;
      continue;
    }

    if (tokens[j] == "\n") {
      indentLevel = 0;
      continue;
    }

    // Handle arrow notation
    if (tokens[j] == "->") {
      const prevToken = tokens[j - 1];

      if (!isInStateBlock) {
        if (prevToken.match(/\((.)\)/s)) {
          // is of the form a(b) ->
          tokens = tokens
            .slice(0, j - 1)
            .concat([
              ":",
              "\n",
              " ".repeat(4),
              "read",
              prevToken[1],
              ":",
              "\n",
              " ".repeat(8),
            ])
            .concat(tokens.slice(j + 1, tokens.length));

          j--;
        } else {
          // is of the form q -> action (not in state block)
          tokens = tokens
            .slice(0, j)
            .concat([
              ":",
              "\n",
              " ".repeat(indentLevel + 4),
              "read",
              "*",
              ":",
              "\n",
              " ".repeat(indentLevel + 8),
            ])
            .concat(tokens.slice(j + 1, tokens.length));
        }
      } else {
        // is of the form
        // state:
        //   a ->
        tokens = tokens
          .slice(0, j)
          .concat([":", "\n", " ".repeat(indentLevel + 4)])
          .concat(tokens.slice(j + 1, tokens.length));
      }

      j -= 1;

      continue;
    }

    // Enter into a block
    if (tokens[j] == ":") {
      if (!isInStateBlock) {
        isInStateBlock = true;
        stateBlockValue = tokens[j - 1].trim();
        stateBlockIndentLevel = indentLevel;
      } else {
        isInReadBlock = true;
        readBlockValue = tokens[j - 1].trim();
        readBlockIndentLevel = indentLevel;
      }

      continue; // Is this line necessary?
    }

    // Leaving the blocks
    if (isInStateBlock) {
      if (indentLevel <= stateBlockIndentLevel!) {
        isInStateBlock = false;
        stateBlockValue = "";
      }
      if (isInReadBlock) {
        if (indentLevel <= readBlockIndentLevel!) {
          isInReadBlock = false;
          readBlockValue = "";
        }
      }
    }

    // Handle logic once inside the blocks
    if (isInStateBlock) {
      if (!isInReadBlock) {
        if (tokens[j - 1] == "read") {
          readBlockValue = tokens[j];

          continue;
        }
      } else {
        const addInformationToTransition = (transition: NTransition) => {
          // If it don't exist, create it
          if (transitions.get(stateBlockValue) == undefined)
            transitions.set(stateBlockValue, []);

          let existingTransition = transitions
            .get(stateBlockValue)!
            .find((transition) => transition.currentCell == readBlockValue);

          const foundTransition = existingTransition != undefined;

          if (existingTransition == undefined) {
            existingTransition = {
              currentState: stateBlockValue,
              currentCell: readBlockValue,
              newCell:
                transition.newCell != undefined ? transition.newCell : "*",
              direction:
                transition.direction != undefined ? transition.direction : "*",
              newState:
                transition.newState != undefined
                  ? transition.newState
                  : stateBlockValue,
            };
          } else {
            if (transition.newCell != undefined) {
              existingTransition["newCell"] = transition.newCell;
            }

            if (transition.direction != undefined) {
              existingTransition["direction"] = transition.direction;
            }

            if (transition.newState != undefined) {
              existingTransition["newState"] = transition.newState;
            }
          }

          if (!foundTransition) {
            transitions.set(stateBlockValue, [
              ...transitions.get(stateBlockValue)!,
              existingTransition,
            ]);
          } else {
            let transitionsArray = transitions.get(stateBlockValue);

            const index = transitionsArray!.findIndex(
              (transition) => transition.currentCell === readBlockValue,
            );

            if (index !== -1) {
              transitionsArray![index] = existingTransition; // swap the element
              transitions.set(stateBlockValue, transitionsArray!); // update map
            }
          }
        };

        if (tokens[j] == "write" || tokens[j] == "move") continue;

        if (tokens[j - 1] == "write") {
          addInformationToTransition({ newCell: tokens[j] });
        } else if (tokens[j - 1] == "move") {
          addInformationToTransition({ direction: tokens[j] });
        } /*if (tokens[j - 1] == "state")*/ else {
          addInformationToTransition({
            newState:
              tokens[j][tokens[j].length - 1] == "!"
                ? "halt-" + tokens[j].substring(0, tokens[j].length - 1)
                : tokens[j],
          });
        }
      }
    }
  }

  //console.log(tokens);
  //tokens.forEach((token) => process.stdout.write("|" + token + "|"));

  return Array.from(transitions.values()).flat() as Transition[];
};

const program = fs.readFileSync("program", "utf8");
getTransitions(program).forEach((transition) => tm.add(transition));

console.log(tm.begin());
console.log(tm.getTape());
