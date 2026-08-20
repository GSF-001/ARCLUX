use std::collections::HashMap;
use crate::models::{User, Post};

pub fn greet(name: &str) -> String {
    format!("hi {}", name)
}

pub struct Config {
    pub port: u16,
}

fn private_helper() {}
