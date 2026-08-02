package main

import "fmt"

func main() {
	u := User{FirstName: "Ada", LastName: "Lovelace"}
	fmt.Println(CreateUserProfile(u))
}
