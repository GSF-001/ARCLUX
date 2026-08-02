package demo;

public class Main {
    public static void main(String[] args) {
        Models.User user = new Models.User();
        user.firstName = "Ada";
        user.lastName = "Lovelace";
        System.out.println(Service.createUserProfile(user));
    }
}
