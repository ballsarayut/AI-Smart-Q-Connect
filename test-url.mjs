const url = "https://maps.app.goo.gl/uPvwR"; // A fake map link, let's see how they resolve.
async function run() {
  try {
    const res = await fetch("https://maps.app.goo.gl/");
    console.log("url:", res.url);
    console.log("status:", res.status);
    console.log("text:", await res.text());
  } catch(e) {
    console.log(e);
  }
}
run();
