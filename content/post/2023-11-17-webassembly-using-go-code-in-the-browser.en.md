---
title: "WebAssembly: using Go code in the browser"
date: 2023-11-17T08:00:43-03:00
draft: false
---
Occasionally, a technology emerges that significantly impacts developers' daily lives—things like Linux, Git, Docker, and Kubernetes, among others. WebAssembly is a technology that has the potential to appear on this select list.

> WebAssembly (also known as WASM) was launched in 2017 as a binary instruction format for a stack-based virtual machine developed to run in modern web browsers to provide "efficient execution and compact representation of code on modern processors including in a web browser.
>> [Source](https://thenewstack.io/webassembly/what-is-webassembly-and-why-do-you-need-it/)

As the definition says, as a "binary instruction format," we can execute code generated by any programming language capable of generating this format. In this post, we will do this with Go.

I looked for code for this test that used essential language features, such as goroutines and channels. I remembered why I started using Go back in 2015. I wanted to run some simulations based on the [Monte Carlo Method](https://en.wikipedia.org/wiki/Monte_Carlo_method) concept, and Go's concurrency facility was perfect for solving this problem. I researched and found an [excellent example](https://www.soroushjp.com/2015/02/07/go-concurrency-is-not-parallelism-real-world-lessons-with-monte-carlo-simulations/) of what I wanted to test. I made some minor changes, and the code looked like this:

```go
package main

import (
	"fmt"
	"math/rand"
	"runtime"
	"time"
)

func main() {
	fmt.Println(pi(10000))
}

func pi(samples int) float64 {
	cpus := runtime.NumCPU()

	threadSamples := samples / cpus
	results := make(chan float64, cpus)

	for j := 0; j < cpus; j++ {
		go func() {
			var inside int
			r := rand.New(rand.NewSource(time.Now().UnixNano()))
			for i := 0; i < threadSamples; i++ {
				x, y := r.Float64(), r.Float64()

				if x*x+y*y <= 1 {
					inside++
				}
			}
			results <- float64(inside) / float64(threadSamples) * 4
		}()
	}

	var total float64
	for i := 0; i < cpus; i++ {
		total += <-results
	}

	return total / float64(cpus)
}

```

With the Monte Carlo Method, the more simulations we run, the more accurate the result, so performance and concurrency are crucial to the algorithm's efficiency.

Let's now make some changes to the code to run it in the browser.

```go
package main

import (
	"math/rand"
	"runtime"
	"syscall/js"
	"time"
)

func main() {
	js.Global().Set("jsPI", jsPI())
	<-make(chan bool)
}

func pi(samples int) float64 {
	cpus := runtime.NumCPU()

	threadSamples := samples / cpus
	results := make(chan float64, cpus)

	for j := 0; j < cpus; j++ {
		go func() {
			var inside int
			r := rand.New(rand.NewSource(time.Now().UnixNano()))
			for i := 0; i < threadSamples; i++ {
				x, y := r.Float64(), r.Float64()

				if x*x+y*y <= 1 {
					inside++
				}
			}
			results <- float64(inside) / float64(threadSamples) * 4
		}()
	}

	var total float64
	for i := 0; i < cpus; i++ {
		total += <-results
	}

	return total / float64(cpus)
}

func jsPI() js.Func {
	return js.FuncOf(func(this js.Value, args []js.Value) any {
		if len(args) != 1 {
			return "Invalid no of arguments passed"
		}
		samples := args[0].Int()

		return pi(samples)
	})
}

```

The first change is creating the function `jsPI()` to interface the Go code and the browser's JavaScript. It is this function that we will invoke via JavaScript.

In the function `main`, we need to include the instruction `js.Global().Set("jsPI", jsPI())` so that it is possible to invoke it jsPI from JavaScript. It is also necessary to include the snippet `<-make(chan bool)` so that the code continues executing, or it will be terminated before being invoked by JavaScript, generating an error in the browser console.

The next step is to compile using the command:

```bash
GOARCH=wasm GOOS=js go build -o pi.wasm
```

The result is a binary in the format expected by WebAssembly.

Let's create the HTML and JavaScript, invoking the Go code. To do this, we need to include in our project one `js` that is provided by the Go language, with the command:

```bash
cp "$(go env GOROOT)/misc/wasm/wasm_exec.js" .
```

Our code `index.html` looked like this:

```html
<!DOCTYPE html>
<html>

<head>
    <meta charset="utf-8">
    <title>Go + WebAssembly Example</title>
</head>

<body>

    <script src="/wasm_exec.js"></script>
    <script>
        function pi() {
            const go = new Go();
            WebAssembly.instantiateStreaming(fetch("pi.wasm"), go.importObject).then((result) => {
                go.run(result.instance);
                v = jsPI(parseInt(document.getElementById("simulations").value))
                document.getElementById("result").textContent = v
            });


        }
    </script>
</body>
<form>
    Simulations: <input type="text" id="simulations">
    <input type="button" value="Calculate" onclick="pi()">
    <div id="result"></div>
</form>

</html>
```

We need a web server to deliver the files `html`, `js`, and `wasm`. For this purpose, we can use any server, such as Caddy, Nginx, or even an application written in Go. To make the example more straightforward, I chose to use the web server built into the Python language, which is native to my macOS:

```bash
python3 -m http.server
```

Now we can access the address `http://localhost:8000` in the browser, fill in the number of simulations in the form, and view the result:

[![wasm](/images/posts/wasm.png)](/images/posts/wasm.png)

And we have a competing algorithm, written in Go, running natively in our browser. It opens up incredible possibilities, from complex algorithms to graphics or game libraries. Furthermore, we can create Web applications using components written in Go, Rust, Java, etc. Reusing code is always a good practice.

A fact to consider in this example is the size of the generated binary:

```bash
❯ ls -lha
total 3432
drwxr-xr-x   7 eminetto  staff   224B 17 Nov 08:47 .
drwxr-xr-x  65 eminetto  staff   2,0K 17 Nov 08:22 ..
-rw-r--r--@  1 eminetto  staff    51B 17 Nov 08:22 go.mod
-rw-r--r--   1 eminetto  staff   732B 17 Nov 08:41 index.html
-rw-r--r--   1 eminetto  staff   894B 17 Nov 08:31 main.go
-rwxr-xr-x   1 eminetto  staff   1,6M 17 Nov 08:31 pi.wasm
-rw-r--r--@  1 eminetto  staff    16K 17 Nov 08:39 wasm_exec.js
```

The `pi.wasm` file has a `1.6m` size, which can be a problem depending on the case. One solution to this problem is to use [TinyGo](https://tinygo.org/docs/guides/webassembly/), a version of the language used in IoT and WebAssembly environments. It purposely has fewer features than the original language but allows the generation of tiny binaries. We can use this solution in some scenarios, such as the ones I will mention in the following posts in this series.

I hope this first post serves to encourage you to test WebAssembly and make you curious to follow the subsequent texts I want to write on the subject ;)