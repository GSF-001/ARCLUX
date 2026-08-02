package main

func CreateUserProfile(u User) string {
	return Slugify(u.FirstName + " " + u.LastName)
}
