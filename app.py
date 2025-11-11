from flask import Flask, render_template, abort

from languages import LANGUAGES

app = Flask(__name__)


@app.route("/")
def index():
    return render_template("index.html", languages=LANGUAGES)


@app.route("/language/<language_name>")
def language_detail(language_name: str):
    language = next(
        (lang for lang in LANGUAGES if lang["name"].lower() == language_name.lower()),
        None,
    )
    if language is None:
        abort(404, description="Language not found")
    return render_template("language_detail.html", language=language)


if __name__ == "__main__":
    app.run(debug=True)

