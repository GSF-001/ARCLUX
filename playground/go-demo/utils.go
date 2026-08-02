package main

import "strings"

func Slugify(text string) string {
	return strings.ToLower(strings.ReplaceAll(text, " ", "-"))
}

// UnusedHelper is never called anywhere — should be flagged by detectUnusedExports
// once the Go parser exists.
func UnusedHelper() {}
