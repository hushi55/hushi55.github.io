---
layout: post
title: gcc 下使用汇编
description: gcc 中使用汇编
category: code
tags: [c, gcc, linux, assembly]
---

<pre>
asm(code
	: output operand list
	: input operand list
	: clobber list
);
</pre>

Register name：
Register的名稱前面必須加上”%”

    AT&T：%eax
    Intel：eax

為了讓GCC的asm能跨平台，所以可以用%0、%1...%n代表後面依序出現的register。


Source/Destination ordering：
AT&T的source永遠在左邊而destination永遠在右邊

    AT&T：movl %eax, %ebx
    Intel：mov ebx, eax
    您可以在Instruction後面會被加上b、w和l，用以區分operand的size，分別代表byte、word和long，在不加的情況下，gcc會自動判斷，但有可能誤判。




Constant value/immediate value format：
Constant value/immediate value前面必須加上”$”

    AT&T：movl $boo, %eax
    Intel：mov eax, boo
    將boo的address載到eax中，boo必須是static變數。


## 参考
http://alpha-blog.wanglianghome.org/2011/04/07/gcc-inline-asm/
http://nano-chicken.blogspot.com/2010/12/inline-assembly.html

[-10]:    http://hushi55.github.io/  "-10"
