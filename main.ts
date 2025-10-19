import fs from "fs";
import { TM, Transition, NTransition } from "./adt";

const args = Bun.argv
  .slice(2, Bun.argv.length)
  .map((arg) => (arg == "\epsilon" ? "" : arg));

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
      if (line[j] == ")" && isInComment) {
        isInComment = false;
        line[j] = "";
      }

      if (
        isInComment ||
        line[j - 1] == ":" ||
        // (isInComment && line[j] == ")") ||
        (line[j] == "(" && (line[j - 1] == undefined || line[j - 1] == " "))
      ) {
        line[j] = "";
        isInComment = true;
      }
    }

    lines[i] = line.join("");
  }

  // Doing macros now
  let macros = new Map<string, (args: string[]) => string>();
  let isInMacro = false;
  let macroName = "";
  let macroLines: string[] = [];
  let macroArguments: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes("#define")) {
      macroName = lines[i].split(" ")[1];
      macroArguments = lines[i].split(" ").slice(2);
      isInMacro = true;
      lines[i] = "";
    } else if (lines[i].includes("#enifed") && isInMacro) {
      let macroLinesCopy = [...macroLines];
      let macroArgumentsCopy = [...macroArguments];

      macros.set(macroName, (args) => {
        return macroLinesCopy
          .map((line) => {
            let expanded = line;
            for (let k = 0; k < macroArgumentsCopy.length; k++) {
              expanded = expanded.replaceAll(
                `{${macroArgumentsCopy[k]}}`,
                args[k] ?? "",
              );
            }
            return expanded;
          })
          .join("\n");
      });

      isInMacro = false;
      macroName = "";
      macroArguments = [];
      macroLines = [];
      lines[i] = "";
    } else if (isInMacro) {
      macroLines.push(lines[i]);
      lines[i] = "";
    }
  }

  program = lines.join("\n");

  program = program.replaceAll(/\{[^\s{}]+(?:\s[^{}]*)?\}/g, (match) => {
    match = match.slice(1).slice(0, -1);
    const [macroName, ...args] = match.split(" ");
    return macros.get(macroName)!(args);
  });

  const tokenise = (text: string): string[] =>
    text.match(
      /(^ +)| {2,}(?=[\w*!])|\r?\n|->|\([^) ]\)|\{[^}\r\n]*\}|:|[\w*!]+(?:[-_][\w*!]+)*|[-_!]/gm,
    ) ?? [];

  let tokens = tokenise(program);

  tokens = tokens.flatMap((t) => (t === "else" ? ["read", "*"] : [t]));
  tokens = tokens.map((t) => (t == "right" || t == "left" ? t[0] : t));

  let indentLevel = 0;

  // Start of processing new syntax into Morphett
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

const program = fs.readFileSync("program.btm", "utf8");
const transitions = getTransitions(program);

fs.writeFileSync("morphett.txt", "");

transitions.forEach((transition) => {
  fs.appendFileSync(
    "morphett.txt",
    `
    ${transition.currentState}
    ${transition.currentCell}
    ${transition.newCell}
    ${transition.direction}
    ${transition.newState}
    `
      .replaceAll("\n", "")
      .replaceAll(/  +/g, " ")
      .trim() + "\n",
  );
});

args.forEach((arg: string) => {
  const tm = new TM(arg);
  transitions.forEach((transition) => tm.add(transition));
  process.stdout.write(`${arg} ->`);
  const finalTransitionState = tm.begin();
  process.stdout.write(` ${tm.getTape()}`);
  process.stdout.write(`: ${finalTransitionState}\n`);
});
