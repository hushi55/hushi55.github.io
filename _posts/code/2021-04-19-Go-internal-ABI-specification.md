---
layout: post
title: Go internal ABI specification
description: golang ABI 相关研读
category: code
tags: [linux, go]
---
最近在研究 ebpf trace golang 程序，在 ebpf 读取 golang function 的函数如参和返回值时，遇到一些关于 golang ABI 相关的问题，
所以有必要研读下 golang 的 ABI specification，这篇文章完全是 [Go internal ABI specification](https://go.googlesource.com/go/+/refs/heads/dev.regabi/src/cmd/compile/internal-abi.md)
的一个翻译，大家可以自行查看原文，本文只是一个 ebpf 研究过程中帮助作者理解的一个过程文档记录。

## Memory layout

### built-in types

|Type               |64-bit| |32-bit| |
| --- | :---: | :---: | :---: | :---: |
|                   |Size|Align|Size|Align|
|bool, uint8, int8	|1|	1|	1|	1|
|uint16, int16		|2|	2|	2|	2|
|uint32, int32		|4|	4|	4|	4|
|uint64, int64		|8|	8|	8|	4|
|int, uint			|8|	8|	4|	4|
|float32			|4|	4|	4|	4|
|float64			|8|	8|	8|	4|
|complex64			|8|	4|	8|	4|
|complex128			|16|8| 16|	4|
|uintptr, *T, unsafe.Pointer|8|	8|	4|	4|

- `byte` 和 `rune` 分别是 `uint8` 和 `int32` 的别名
- `map`, `chan`, 和 `func` 等同于 `*T` 类型

### composite types
我们做如下定义，`S` 是由 `N` 个属性组成了，`N` 个属性类型分别为 `t1`,`t2`,...,`tn`。
```
offset(S, i) = 0  if i = 1
= align(offset(S, i-1) + sizeof(t_(i-1)), alignof(t_i))
alignof(S)   = 1  if N = 0
= max(alignof(t_i) | 1 <= i <= N)
sizeof(S)    = 0  if N = 0
= align(offset(S, N) + sizeof(t_N), alignof(S))
```

- 
- `[N]T` 是由 `N` 个 `T` 类型的属性组成.
- 切片 `[]T` 是由一个 `*[cap]T` 的指针, 一个 `int` 类型存储长度, 和一个 `int` 类型存储容量，总共 3 个属性组成.
- `string` 类型是由一个 `*[len]byte` 指针, 一个 `int` 类型存储长度.
- 一个 struct `{ f1 t1; ...; fM tM }` 是由 `t1`, ..., `tM`, `tP` 顺序排列组成, 其中 `tP` :
    * Type byte if `sizeof(tM) = 0 `and any of `sizeof(ti) ≠ 0`.
    * 否则为空 (size 0 and align 1) .

## Function call argument and result passing

golang 函数之间的调用传递参数和结果是通过使用 stack 和 registers 的联合方式。
每个参数或者结果都可以完全使用 stack 或者 registers 的方式。
由于使用 registers 的方式比 stack 的方式性能更优，所有会优先使用 registers 的方式。
但是参数或者结果包含 `non-trivial array` 或者不适合存储在寄存器中，那么就只能通过 stack 的方式。

每种架构下都会定义一系列的 `integer` 和 `floating-point` 类型的寄存器。
总体上将，参数和结果集合会将负载类型拆解为基本类型，然后分配给上述两种寄存器种。

参数和结果集合可以共享寄存器，但是不能共享栈空间。
除了栈上传递参数和结果集外，`caller` 会为寄存器参数保留栈空间在溢出空间，但是不会初始化这个空间。

函数调用者，参数，结构集 和 函数 `F` 在栈，寄存器上的分配遵循下面的算法：

1. 令 `NI` 和 `NFP` 分别为 `integer` 和 `floating-point` 寄存器的总数，令 `I` 和 `FP` 为 0，它们表明下个 `integer` 和 `floating-pointer` 寄存器的下标，
   令 `S` 是这个类型的栈贞，为空。
2. 如果 `F` 是函数方法，分配 `F` 的调用者。
3. 分配 `F` 的每一个参数 `A`
4. 添加指针对齐的属性到 `S`。该字段大小为 0，对其方式为 `uintptr` 类型。
5. 设置 `I` 和  `FP` 从 0 开始。
6. 分配函数 `F` 的每一个结果 `R`
7. 添加指针对齐的属性到 `S`。
8. 对于函数 `F` 的每一个寄存器分配的类型参数，令 `T` 类型添加到栈空间 `S` 中。并且这个参数属于栈溢出区，不会被调用者初始化。
9. 添加指针对齐的属性到 `S`。

分配调用者，参数，或者结果集中的 `T` 类型结果 `V`，遵循下述流程：

1. 记住 `I` 和 `FP` 下标。
2. 尝试在寄存器中分配 `V`。
3. 如果第二部失败，设置 `I` 和 `FP` 的值到第一步中的只，在栈空间添加 `T`，并且分配 `V` 到栈空间的这个属性上。

寄存器上分配 `V` 遵循下述流程：

1. 如果 `T` 是一个 `boolean` 或者 `integral` 类型，适合 `integer` 寄存器，分配 `V` 到寄存器 `I` 并且 `I` 的下标增加 1。
2. 如果 `T` 是适合两个 `integer` 寄存器，那么分配 `V` 的最高/最低 有效位分配给 `I` 和 `I+1`,并且 `I` 增加 2。
3. 如果 `T` 是适合 `floating-point` 类型的寄存器，分配 `V` 到寄存器 `FP` 并且 `FP` 的下标增加 1。
4. 如果 `T` 是 `complex` 类型，那么分别分配复数的实数和虚数部分
5. 如果 `T` 是 `pointer` `map` `channel` `function` 类型，分配 V 到寄存器 I 并且 I 的下标增加 1。
6. 如果 `T` 是 `string` `interface` `slice` 类型，递归调用 `V` 的各个部分(`strings` 和 `interfaces` 有两个属性组成，`slices` 是 3 )。
7. 如果 `T` 是 `struct` 类型，递归分配 `V` 的各个属性。
8. 如果 `T` 是数组类型，并且长度为 0, 不需要做任何事情。
9. 如果 `T` 是数组类型，并且长度为 1, 递归分配该元素。
10. 如果 `T` 是数组类型，并且长度大于 1，分配失败。
11. 如果 `I` > `NI` 或者 `FP` > `NFP`，分配失败。
12. 如果任何上诉递归分配失败，则失败。

通过上面的算法分配好的 参数，结果集，在栈的最终结果大体上如下:

1. stack-assigned receiver
2. stack-assigned arguments
3. pointer-alignment
4. stack-assigned results
5. pointer-alignment
6. spill space for each register-assigned argument
7. pointer-alignment

入下图所示，0 地址在最下端：


```
+------------------------------+
|             . . .            |
| 2nd reg argument spill space |
| 1st reg argument spill space |
| <pointer-sized alignment>    |
|             . . .            |
| 2nd stack-assigned result    |
| 1st stack-assigned result    |
| <pointer-sized alignment>    |
|             . . .            |
| 2nd stack-assigned argument  |
| 1st stack-assigned argument  |
| stack-assigned receiver      |
+------------------------------+ ↓ lower addresses
```

## Example
假设在 `64-bit architecture` 架构上存在 `R0–R9` 寄存器，并且函数签名如下：

`func f(a1 uint8, a2 [2]uintptr, a3 uint8) (r1 struct { x uintptr; y [2]uintptr }, r2 string)` 

在函数进入时， `a1` 分配到 `R0`, `a3` 分配到 `R1` 上，其他参数在栈上内存布局如下：

```
a2      [2]uintptr
r1.x    uintptr
r1.y    [2]uintptr
a1Spill uint8
a2Spill uint8
_       [6]uint8  // alignment padding
```

在栈上只有 `a2` 会在函数进入时初始化，剩下到栈都不会初始化。
在函数退出时，`r2.base` 会分配到 `R0`, `r2.len` 分配到 `R1`, `r1.x` 和 `r1.y` 是在栈上初始化.
在上面到列子中，我们需要注意以下几点： 

1. `a2` 和 `r1` 在栈上分配时由于包含了数组，其他参数分配在寄存器上. 
2. `r2` 被分解为 2 个单独的属性，并且在寄存器上分配。

在栈上，基于栈分配的参数时出现在基于栈分配的返回值的低地址空间。


## 参考
- [Go internal ABI specification](https://go.googlesource.com/go/+/refs/heads/dev.regabi/src/cmd/compile/internal-abi.md)

[-10]:    http://hushi55.github.io/  "-10"
