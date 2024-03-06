---
layout: ../../layouts/index.astro
title: Some testing
image: /nnago/banner1.jpg
date: 03/06/2024
tags: mock
description: Yeah
---

![Banner](../../../public/banner1.jpg)

# Hello

there

# Some code

```go
func NewHistory(filepath string) *History {
	return &History{
		filepath: filepath,
	}
}

func (history *History) Setup(editor *lineEditor.LineEditor) {
	lineEditor.NewBinding(editor, 14, next)     // ctrl+n
	lineEditor.NewBinding(editor, 16, previous) // ctrl+p
	lineEditor.NewBinding(editor, 18, menu)     // ctrl+r

	lineEditor.On(editor, event.LINE_ACCEPTED, writeCommand)

	history.createFileIfNotExists()

}

func (history *History) Exec(editor *lineEditor.LineEditor) {
	return
}
```
