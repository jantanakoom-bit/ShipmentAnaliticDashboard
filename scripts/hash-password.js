import bcrypt from "bcryptjs";

const args = process.argv.slice(2);

if (args.length !== 1 || args[0] !== "--stdin") {
  console.error("Usage: read -s PASSWORD && printf '%s\\n' \"$PASSWORD\" | npm run hash-password -- --stdin; unset PASSWORD");
  process.exit(1);
}

const password = (await readStdin()).trimEnd();

if (!password || password.length < 8) {
  console.error("Password must be at least 8 characters.");
  process.exit(1);
}

const hash = await bcrypt.hash(password, 12);
console.log(hash);

function readStdin() {
  return new Promise((resolve, reject) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      data += chunk;
    });
    process.stdin.on("end", () => resolve(data));
    process.stdin.on("error", reject);
  });
}
