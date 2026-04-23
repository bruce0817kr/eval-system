from passlib.hash import sha256_crypt


def run() -> None:
    password = "admin"
    password_hash = sha256_crypt.hash(password)
    print("development admin credentials")
    print("login_id=admin")
    print("password=admin")
    print(f"ADMIN_PASSWORD_HASH={password_hash}")


if __name__ == '__main__':
    run()
