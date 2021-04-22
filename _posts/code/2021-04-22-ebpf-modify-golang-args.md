---
layout: post
title: ebpf 修改golang 函数参数
description: 使用 ebpf 修改 golang 函数的入参和返回值
category: code
tags: [linux, go]
---
最近在研究 ebpf traceing golang 的函数入参和返回值，这个需要对程序的内存布局有比较熟悉的了解。
这篇文章就是研究过程中的一个记录

## ebpf 实验
如何使用 ebpf 读取和修改 golang 函数的入参呢？我们使用下面的列子来演示
```go
package main

import "fmt"

//go:noinline
func parseMe(a1 int, a2 bool, a3 float32) (r1 int64, r2 int32, r3 string) {
	// some code
	d := 100 + a1;
	fmt.Printf("%v, %v, %v, %v \n", a1, a2, a3, d)
	return 100, 200, "test for ebpf"
}


func main() {
	a, b, c := parseMe(1, true, 96.69)
	fmt.Printf("%v, %v, %v \n", a, b, c)
}
```

```go
package main

import (
	"fmt"
	"log"
	"os"
	"os/signal"

	"github.com/iovisor/gobpf/bcc"
)

const eBPF_Program = `
#include <uapi/linux/ptrace.h>
BPF_PERF_OUTPUT(events);
inline int get_arguments(struct pt_regs *ctx) {
		void* stackAddr = (void*)ctx->sp;

		//long bpf_probe_read_str(void *dst, u32 size, const void *unsafe_ptr)
		long argument1;
		bpf_probe_read(&argument1, sizeof(argument1), stackAddr+8); 
		events.perf_submit(ctx, &argument1, sizeof(argument1));
		//long bpf_probe_write_user(void *dst, const void *src, u32 len)
		long argument1_tmp = 2021;
		bpf_probe_write_user(stackAddr+8, &argument1_tmp, sizeof(argument1_tmp));
	
		char argument2;
		bpf_probe_read(&argument2, sizeof(argument2), stackAddr+16); 
		events.perf_submit(ctx, &argument2, sizeof(argument2));

		float argument3;
		bpf_probe_read(&argument3, sizeof(argument3), stackAddr+20); 
		events.perf_submit(ctx, &argument3, sizeof(argument3));	
			
		
}
`

func main() {

	bpfModule := bcc.NewModule(eBPF_Program, []string{})

	uprobeFd, err := bpfModule.LoadUprobe("get_arguments")
	if err != nil {
		log.Fatal(err)
	}

	err = bpfModule.AttachUprobe(os.Args[1], "main.parseMe", uprobeFd, -1)
	if err != nil {
		log.Fatal(err)
	}

	table := bcc.NewTable(bpfModule.TableId("events"), bpfModule)
	channel := make(chan []byte)
	lost := make(chan uint64)

	perfMap, err := bcc.InitPerfMap(table, channel, lost)
	if err != nil {
		log.Fatal(err)
	}

	c := make(chan os.Signal, 1)
	signal.Notify(c, os.Interrupt)

	go func() {
		for {
			value := <-channel
			fmt.Printf("%v# \n", value)
		}
	}()

	perfMap.Start()
	<-c
	perfMap.Stop()
}
```

我们首先编译这个两个程序输出如下：
```shell
#go build test.go
#go build read_trace.go

-rw-r--r--  1 root  324 Apr 22 11:15 test.go
-rwxr-xr-x  1 root 1.9M Apr 22 11:15 test
-rw-r--r--  1 root 1.6K Apr 22 11:16 read_trace.go
-rwxr-xr-x  1 root 2.5M Apr 22 11:16 read_trace
```

使用如下命令运行 `read_trace` 程序:

```shell
# ./read_trace ./test
/virtual/main.c:24:1: warning: control reaches end of non-void function [-Wreturn-type]
}
^
1 warning generated.
```
在另外一个窗口中执行以下命令运行 `test`, 输出如下:
```shell
# ./test
2021, true, 96.69, 2121
100, 200, test for ebpf
```

`read_trace` 输出如下:
```shell
# ./read_trace ./test
/virtual/main.c:24:1: warning: control reaches end of non-void function [-Wreturn-type]
}
^
1 warning generated.
[1 0 0 0 0 0 0 0 0 0 0 0]#
[1 0 0 0]#
[72 97 193 66]#
```

### 结果分析
从上面的数据结果来分析，我们可以得出以下结论
1. `parseMe(1, true, 96.69)` 函数调用传递的参数 `a1` 是 1
2. ebpf 在运行过程动态的修改了 `argument1_tmp = 2021;` 2021，并且在 `test` 的输出中也打印了2021
3. ebpf 程序中 `read_trace` 在输出中，将 `a1`, `a2`, `a3` 的值都打印出来了，并且也是正确的。

问题：
1. 为什么 ebpf 程序中读取 golang 的参数采用了 `(void*)ctx->sp` 的相对位置
2. 为什么 ebpf 程序中读取第参数分别是 `sp` 的相对位置偏移 8, 16, 20

### golang 调用规约
要回上述问题，我们就需要了解 golang 的函数调用规约，和 golang ABI 的内存布局 
golang 1.16.x 版本之前的调用规约，遵循如下情况:

- 所有参数的传递都是在栈上
  * 位置相对于 `FP` 指针
- 返回值和输入参数一致，也是在栈上传递
– 返回值以指针大小对齐
- 所有的寄存器由调用方保存，除以下几种情况:
  * Stack pointer register
  * Zero register (if there is one)
  * G context pointer register (if there is one) – Frame pointer (if there is one)
 
也就是说 golang 的调用规约是 `stack-base` ，当然当前为了提升 golang 的性能，
`register-base` 的调用规约也在讨论中，感兴趣可以参考[这里](https://go.googlesource.com/proposal/+/refs/changes/78/248178/1/design/40724-register-calling.md)
其次关于 golang 的内存布局可以参考[这里](http://hushi55.github.io/2021/04/19/Go-internal-ABI-specification),
内存对齐可以参考[这里](http://hushi55.github.io/2021/04/21/Go-internal-memory-layout)

### 函数参数内存布局
根据上文中的 golang 内存布局和内存对齐，我们知道

1. `int` `sizeof(int)` 是 8 个字节， `alignof(int)` 是 8 个字节
2. `bool` `sizeof(bool)` 是 1 个字节， `alignof(bool)` 是 1 个字节
3. `float32` `sizeof(float32)` 是 4 个字节， `alignof(float32)` 是 4 个字节

所以最终的内存布局入下图所示：

![](/images/golang/golang-args-layout.png)

由于 `alignof(float32)` 是 4 字节对齐，所有 `a2`, `a3` 之间需要填充 3 个字节的数据。这样就回答之前的 2 个问题。

## ebpf 修改返回值
```go
package main

import (
	"fmt"
	"log"
	"os"
	"os/signal"

	"github.com/iovisor/gobpf/bcc"
)

const eBPF_Program = `
#include <uapi/linux/ptrace.h>
BPF_PERF_OUTPUT(events);
inline int get_arguments(struct pt_regs *ctx) {
		void* stackAddr = (void*)ctx->sp;

		/**
		 * return
         */
		long argument4;
		bpf_probe_read(&argument4, sizeof(argument4), stackAddr+16);
		events.perf_submit(ctx, &argument4, sizeof(argument4));
		long argument4_tmp = 3021;
		bpf_probe_write_user(stackAddr+16, &argument4_tmp, sizeof(argument4_tmp));

		int argument5;
		bpf_probe_read(&argument5, sizeof(argument5), stackAddr+24);
		events.perf_submit(ctx, &argument5, sizeof(argument5));
		long argument5_tmp = 4021;
		bpf_probe_write_user(stackAddr+24, &argument5_tmp, sizeof(argument5_tmp));

}
`

func main() {

	bpfModule := bcc.NewModule(eBPF_Program, []string{})

	uprobeFd, err := bpfModule.LoadUprobe("get_arguments")
	if err != nil {
		log.Fatal(err)
	}

	err = bpfModule.AttachUretprobe(os.Args[1], "main.parseMe", uprobeFd, -1)
	if err != nil {
		log.Fatal(err)
	}

	table := bcc.NewTable(bpfModule.TableId("events"), bpfModule)
	channel := make(chan []byte)
	lost := make(chan uint64)

	perfMap, err := bcc.InitPerfMap(table, channel, lost)
	if err != nil {
		log.Fatal(err)
	}

	c := make(chan os.Signal, 1)
	signal.Notify(c, os.Interrupt)

	go func() {
		for {
			value := <-channel
			fmt.Printf("%v# \n", value)
		}
	}()

	perfMap.Start()
	<-c
	perfMap.Stop()
}
```

同样的我们编译上面的程序，并且运行该程序，输出如下:
```shell
# go build return_trace.go
root@iZwz91577x7sn1xi9myalsZ:/home/admin/ebpf# ./return_trace ./test
/virtual/main.c:22:1: warning: control reaches end of non-void function [-Wreturn-type]
}
^
1 warning generated.
```
在另外一个窗口中执行以下命令运行 `test`, 输出如下:
```shell
# ./test
1, true, 96.69, 101
3021, 4021, test for ebpf
```
从上面的输出可以看出来，返回值 `r1`, `r2` 被 ebpf 程序动态修改了。

### golang 函数返回值内存布局
通过上文中的 golang 内存布局和内存对齐，我们知道 `r1`, `r2` 的大小分别为 8 和 4，对齐字节数分别为 8， 4。
但是我们读取 golang 的 args 使用的 ebpf 探针是 `AttachUprobe`， 而读取 golang 的返回值探针是 `AttachUretprobe`
并且 `AttachUretprobe` 探针应该是 `PC` 寄存器恢复到了调用侧，就是 `main` 函数，结合上述这时的内存布局如下图:

![](/images/golang/golang-rets-layout.png)

并且 `r1`, `r2` 相对于 `SP` 的位置分别为 16 和 24。

## 参考
- [Tracing Go Functions with eBPF Part 1](https://www.grant.pizza/blog/tracing-go-functions-with-ebpf-part-1/)
- [Tracing Go Functions with eBPF Part 2](https://www.grant.pizza/blog/tracing-go-functions-with-ebpf-part-2/)
- [BPF-HELPERS](https://man7.org/linux/man-pages/man7/bpf-helpers.7.html)

[-10]:    http://hushi55.github.io/  "-10"
