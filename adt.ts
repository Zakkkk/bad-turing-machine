export type Transition = {
  currentState: string;
  currentCell: string;
  newCell: string;
  direction: string;
  newState: string;
};

export type NTransition = Partial<Transition>;

const directionIsValid = (direction: string): boolean =>
  direction == "left" ||
  direction == "l" ||
  direction == "right" ||
  direction == "r" ||
  direction == "stay" ||
  direction == "*";

export class TM {
  private tape: Map<number, string>;
  private pointer: number;
  private transitions: Map<string, Transition[]>;
  private initialState: string;

  constructor(input: string) {
    this.tape = new Map<number, string>();
    this.transitions = new Map<string, Transition[]>();

    for (let i = 0; i < input.length; i++) {
      this.tape.set(i, input[i]);
    }

    this.pointer = 0;
  }

  read(): string {
    return this.tape.has(this.pointer) ? this.tape.get(this.pointer)! : "_";
  }

  write(symbol: string) {
    if (symbol.length != 1) {
      throw new Error("Can only write a single character.");
    }

    if (symbol == "_") this.tape.delete(this.pointer);
    if (symbol != "*") this.tape.set(this.pointer, symbol);
  }

  move(direction: string) {
    if (!directionIsValid(direction))
      throw new Error("Direction must be '[l]eft' '[r]ight' or 'stay'/'*'.");
    if (direction == "left" || direction == "l") this.pointer -= 1;
    if (direction == "right" || direction == "r") this.pointer += 1;
  }

  add(transition: Transition | string[]) {
    if (Array.isArray(transition)) {
      transition = {
        currentState: transition[0],
        currentCell: transition[1],
        newCell: transition[2],
        direction: transition[3],
        newState: transition[4],
      };
    }

    if (!directionIsValid(transition.direction))
      throw new Error("Direction must be '[l]eft' '[r]ight' or 'stay'/'*'.");

    if (transition.currentCell.length != 1 || transition.newCell.length != 1) {
      throw new Error("Symbols can only be a single character.");
    }

    if (
      this.transitions
        .get(transition.currentState)
        ?.every((t) => t.currentCell == transition.currentCell)
    ) {
      throw new Error(
        `Cannot add duplicate transition ${transition.currentState}(${transition.currentCell}).`,
      );
    }

    if (this.transitions.size == 0) this.initialState = transition.currentState;

    if (this.transitions.get(transition.currentState) == undefined)
      this.transitions.set(transition.currentState, []);

    this.transitions.set(transition.currentState, [
      ...this.transitions.get(transition.currentState)!,
      transition,
    ]);
  }

  setInitialState(state: string) {
    this.initialState = state;
  }

  getInitialState(): string {
    return this.initialState;
  }

  begin(): string | void {
    let symbol: string;
    let state = this.initialState;

    while (true) {
      symbol = this.read();

      if (this.transitions.has(state)) {
        const matchingTransition = this.transitions
          .get(state)
          ?.find((t) => t.currentCell == symbol);

        const starTransition = this.transitions
          .get(state)
          ?.find((t) => t.currentCell == "*");

        const performTransition = (transition: Transition): string => {
          this.write(transition.newCell);
          this.move(transition.direction);
          return transition.newState;
        };

        if (matchingTransition != undefined) {
          state = performTransition(matchingTransition);
        } else if (starTransition != undefined) {
          state = performTransition(starTransition);
        } else {
          return `halt (no matching transition for ${state}(${symbol}))`;
        }

        if (state.slice(0, 4) == "halt") {
          return state;
        }
      } else {
        return `halt (no matching state for ${state})`;
      }
    }
  }

  getTape(): string {
    if (this.tape.size == 0) return "";
    return [...this.tape.values()].reduce((acc, value) => acc + value);
  }
}
