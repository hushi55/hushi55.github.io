---
layout: post
title: go calling convention
description: go calling convention
category: blog
tags: [linux, go]
---
这篇文章翻译自 `dr knz @ work` go 调用规约，原文出处在文章末尾，作者有两篇文章。
由于最近需要对各种语言对内存布局感兴趣，所以打算先研究 go 语言的调用规约，翻译可能存在错误，欢迎斧正。

## Introduction

## Calling convention

### Arguments and return value

### Call sequence: how a function gets called
在 go 1.10 和 1.15 版本中，
一个函数为被调用函数设置好参数，并且在栈上预留出返回值的空间，被调用函数在返回值写入预留的空间中。

在以前一样，这样设计的一个副作用是，当函数返回一个

As before, a side effect of this design is that when a function returns the same value as one of its callees, 
it needs to read the return value from the callee from its own activation record, 
then place it back onto the stack at a return value in its caller’s activation record. 
Tail call optimizations (TCO) thus remain impossible.

Additionally, function prologues remain largely unchanged:

- 一个函数使用本地变量，需要通过 SP 寄存器相对位置来获取，这个总是出现在前置序言中。
- 和以前一样，每一个函数会设置一个帧指针 BP 寄存器，来方便异常释放。
- 和以前一样，一个函数需要使用更多的栈空间时，这样的情况下需要检查当前栈上的剩余空间，如果不足就需要分配更多的空间。
  这是因为 go 默认为 goroutines 分配很小的栈空间。
  
通产，结束不会做这些操作。

这里又一个例子来自 go 运行时的内部函数，来演示函数序言和结束：

```cgo
internal/cpu.Initialize:
        ; Check remaining stack size:
        MOVQ FS:0xfffffff8, CX
        CMPQ 0x10(CX), SP ; at least 24 bytes on the stack?
        JBE 0x401047      ; no: go to block at end of function below

        ; Allocate activation record:
        SUBQ $0x18, SP    ; 24 bytes in activation record

        ; Set up the frame pointer
        MOVQ BP, 0x10(SP) ; BP is callee-save: store it
        LEAQ 0x10(SP), BP ; set up new frame pointer
        ...

        MOVQ 0x10(SP), BP ; restore the caller's frame pointer
        ADDQ $0x18, SP    ; deallocate the activation record
        RET               ; return

0x401047:
        CALL runtime.morestack_noctxt(SB) ; alloc more stack
        JMP internal/cpu.Initialize(SB) ; restart
```

### Callee-save registers—or not

### The cost of pointers and interfaces

```cgo
// Define a struct type implementing the interface by value.
type bar struct{ x int }
func (bar) foo() {}
// Define a global variable so we don't use the heap allocator.
var y bar

// Make an interface value.
func MakeInterface2() Foo { return y }
```

```cgo
MakeInterface2:
   ; <function prologue>

   ; write y to 0(SP), as an argument to runtime.convT64
   0x45c55d                488b057cc70900          MOVQ main.y(SB), AX
   0x45c564                48890424                MOVQ AX, 0(SP)
   ; call runtime.convT64, this converts the object to a heap reference
   0x45c568                e833c5faff              CALL runtime.convT64(SB)
   ; extract the return value
   0x45c56d                488b442408              MOVQ 0x8(SP), AX
   ; take the vtable pointer
   0x45c572                488d0d07c00200          LEAQ go.itab.main.bar,main.Foo(SB), CX
   ; write both to the return value slot for MakeInterface2
   0x45c579                48894c2420              MOVQ CX, 0x20(SP)
   0x45c57e                4889442428              MOVQ AX, 0x28(SP)

   ; <function epilogue>
   0x45c58c                c3                      RET
```

```cgo
MakeInterface2:
   ; <function prologue>

   ; take the vtable pointer
   0x4805dd              488d053c020400          LEAQ go.itab.src.bar,src.Foo(SB), AX
   ; pass it as argument to convT2I64
   0x4805e4              48890424                MOVQ AX, 0(SP)
   ; take the address of y
   0x4805e8              488d05e9f10b00          LEAQ main.y(SB), AX
   ; pass it as argument to convT2I64
   0x4805ef              4889442408              MOVQ AX, 0x8(SP)
   ; convert to interface reference
   0x4805f4              e8e7b2f8ff              CALL runtime.convT2I64(SB)
   ; copy the return value from runtime.convT2I64 to the return slot of MakeInterface2
   0x4805f9              488b442410              MOVQ 0x10(SP), AX
   0x4805fe              488b4c2418              MOVQ 0x18(SP), CX
   0x480603              4889442430              MOVQ AX, 0x30(SP)
   0x480608              48894c2438              MOVQ CX, 0x38(SP)

   ; <function epilogue>
   0x480616              c3                      RET
```

### Vararg calls

```cgo
func f(...int) {}

var x,y,z,w int
func caller() {
   f(x,y,z,w)
}
```

```cgo
caller:
    ; <function prologue>

    ; fill the slice:
    XORPS X0, X0          ; set 2 words (128 bit) to zero in X0
    MOVUPS X0, 0x18(SP)   ; initialize the 4-element slice to zero
    MOVUPS X0, 0x28(SP)   ; initialize the 4-element slice to zero
    MOVQ main.x(SB), AX
    MOVQ AX, 0x18(SP)     ; store x into 1st position
    MOVQ main.y(SB), AX
    MOVQ AX, 0x20(SP)     ; store y into 2nd position
    MOVQ main.z(SB), AX
    MOVQ AX, 0x28(SP)     ; store z into 3rd position
    MOVQ main.w(SB), AX
    MOVQ AX, 0x30(SP)     ; store w into 4th position

    ; prepare the slice as outgoing argument:
    LEAQ 0x18(SP), AX     ; store the base address
    MOVQ AX, 0(SP)
    MOVQ $0x4, 0x8(SP)    ; store the length
    MOVQ $0x4, 0x10(SP)   ; store the capacity

    CALL main.g(SB)       ; call the function

    ; <function epilogue>
    RET
```

```cgo
// note: now we have an interface type.
func f(...interface{}) {}

var x,y,z,w int
func caller() {
   f(x,y,z,w)
}
```

```cgo
caller:
    ; <function prologue>

    ; fill the slice:
    XORPS X0, X0         ; zero out the slice
    MOVUPS X0, 0x38(SP)
    MOVUPS X0, 0x48(SP)
    MOVUPS X0, 0x58(SP)
    MOVUPS X0, 0x68(SP)

    MOVQ main.x(SB), AX
    MOVQ AX, 0x30(SP)    ; copy x on the stack, out of the slice
    LEAQ 0x7995(IP), AX
    MOVQ AX, 0x38(SP)    ; place x's interface{} vtable ptr in the slice
    LEAQ 0x30(SP), CX
    MOVQ CX, 0x40(SP)    ; place the address of x's copy in the slice

    MOVQ main.y(SB), CX
    MOVQ CX, 0x28(SP)    ; copy y on the stack, out of the slice
    MOVQ AX, 0x48(SP)    ; place the same vtable ptr as x in the slice
    LEAQ 0x28(SP), CX
    MOVQ CX, 0x50(SP)    ; place the address of y's copy in the slice

    MOVQ main.z(SB), CX
    MOVQ CX, 0x20(SP)    ; copy z on the stack, out of the slice
    MOVQ AX, 0x58(SP)    ; place the same vtable ptr as x in the slice
    LEAQ 0x20(SP), CX
    MOVQ CX, 0x60(SP)    ; place the address of z's copy in the slice

    MOVQ main.w(SB), CX  ; copy w on the stack, out of the slice
    MOVQ CX, 0x18(SP)
    MOVQ AX, 0x68(SP)    ; place the same vtable ptr as x in the slice
    LEAQ 0x18(SP), AX
    MOVQ AX, 0x70(SP)    ; place the address of w's copy in the slice

    LEAQ 0x38(SP), AX
    MOVQ AX, 0(SP)       ; set the slice base address as argument
    MOVQ $0x4, 0x8(SP)   ; the slice's size
    MOVQ $0x4, 0x10(SP)  ; the slice's capacity

    CALL main.g(SB)       ; call the function

    ; <function epilogue>
    RET
```

## Exception handling

### Implementation of `defer`

```cgo
func Defer1() int { defer f(); return 123 }
```

```cgo
Defer1:
       ; <function prologue>

       0x45c4bd         MOVQ $0x0, AX
       0x45c4c4         MOVQ AX, 0x8(SP)   ; set up a word full with zeroes
       0x45c4c9         MOVB $0x0, 0x7(SP) ; set the first byte to zero (redundant)

       ; write zero to the return value slot
       0x45c4ce         MOVQ $0x0, 0x20(SP)

       ; defer the call to f()
       0x45c4d7         LEAQ 0x1b672(IP), AX
       0x45c4de         MOVQ AX, 0x8(SP)      ; write the address of f
       0x45c4e3         MOVB $0x1, 0x7(SP)    ; let the runtime know there is 1 defer

       ; write the return value 123
       0x45c4e8         MOVQ $0x7b, 0x20(SP)

       ; un-defer
       0x45c4f1         MOVB $0x0, 0x7(SP)    ; let the runtime know there is no more defer
       ; final call to f() on the return path
       0x45c4f6         CALL main.f(SB)

       ; <function epilogue>
       0x45c504         RET

       ; the following code is called during unwinds after a recover,
       ; not on the common case:
       0x45c505         CALL runtime.deferreturn(SB)
       0x45c50a         MOVQ 0x10(SP), BP
       0x45c50f         ADDQ $0x18, SP
       0x45c513         RET
```

### Implementation of `panic`

```cgo
func Panic() { panic(123) }
```

```cgo
Panic:
   ; <function prologue>

   ; load the vtable for interface{}:
   LEAQ 0x78dc(IP), AX
   MOVQ AX, 0(SP)

   ; load the address of a static copy of the
   ; integer value 123:
   LEAQ 0x2afa9(IP), AX
   MOVQ AX, 0x8(SP)

   ; call gopanic:
   CALL runtime.gopanic(SB)
   NOPL
   ; note: function epilogue omitted in this case
```

### Catching exceptions: `defer` + `recover`

## 参考

- [go calling convention 1](https://dr-knz.net/go-calling-convention-x86-64.html)
- [go calling convention 2](https://dr-knz.net/go-calling-convention-x86-64-2020.html)
- [Register-based Go calling convention](https://go.googlesource.com/proposal/+/refs/changes/78/248178/1/design/40724-register-calling.md)

[-10]:    http://hushi55.github.io/  "-10"

