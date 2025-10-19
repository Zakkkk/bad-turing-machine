Install [bun](https://bun.com/).

Throw your program into `program` and then run the program with `bun run main.ts input input input input`. The program will also be converted into Morphett notation into the `Morphett` file. If you want to test the empty string use `\epsilon` as an input.

Code quality not the best as this is a super quick project with next to no planning

# Examples
## Example program outputs
```
$ bun run main.ts \epsilon a aa aaa abc
-> : halt-reject
a -> a: halt-reject
aa -> aa: halt-reject (no matching transition for start(_))
aaa -> aaa: halt-reject
abc -> abc: halt-accept
```

## Example Programs
```yaml
(Turing machine that acceps 0^n 1^n : n >= 1)

q0:
    read 0 -> write x
              move right
              state q1
    read y -> move right
              state q3

q1:
    read 0 -> move right
    read y -> move right
    read 1 -> write y
              move left
              state q2

q2:
    read y -> move left
    read 0 -> move left
    read x -> move right
              state q0

q3: Can add labels/comments after the colon
    read y -> move right
    read _ -> accept!
    read b -> accept!
```

```yaml
(A program with logic errors, but the program runs fine)

(Short hand using the arrow notation)
start(0) -> write x
            move right
            seek-match
start(x) -> move right (Rest of the information is inconsequential)
start(1) -> reject!
start(_) -> move right
            check-ones

(More explicit notation)
seek-match: Finds the next match
    read 1 -> write x (Can use arrow notation inside this form too)
              move left
              rewind
    read x -> move right
    else   -> reject!

rewind:
    read _: Dont need to use the arrow notation
        move right
        state start (You can write 'state' if you want to)
    else: Short for "read *"
        move left

check-ones:
    _ -> accept!
    1 -> reject!
    else -> move right
```

Note that macros are a work in progress, and you cannot nest macros.
```yaml
#define macro-name param1 param2 param3 param4
{param-1}:
    {param-2} -> move {param3}
                 {param4}
#enifed

{macro-name example-state example-read right end}

q0 -> example-state
```
