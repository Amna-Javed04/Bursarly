"""
Regression tests for the chatbot's scholarship matcher.

The original matcher matched any name token as a substring, so "scholarship"
in a message matched "Knight-Hennessy Scholars" and the assistant answered
about the wrong programme. These tests lock in the scored behaviour.

Run with:  python -m unittest discover -s tests -v
"""

import os
import sys
import unittest
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")

from app.crud import _match_score, _name_tokens, _words  # noqa: E402


def score(name: str, message: str) -> float:
    return _match_score(name, message, set(_words(message)))


class MatcherTests(unittest.TestCase):
    def test_generic_word_scholars_does_not_match(self):
        """The original bug: 'scholars' appearing inside 'scholarship'."""
        message = "What documents are required for the DAAD EPOS Scholarship?"
        self.assertEqual(score("Knight-Hennessy Scholars", message), 0.0)

    def test_named_programme_scores_above_threshold(self):
        message = "What documents are required for the DAAD EPOS Scholarship?"
        self.assertGreater(score("DAAD Scholarships for Development (EPOS)", message), 0.45)

    def test_acronym_alias_matches(self):
        message = "Tell me about GKS eligibility"
        self.assertGreater(score("Global Korea Scholarship (GKS)", message), 0.45)

    def test_unrelated_message_matches_nothing(self):
        message = "How do I track application deadlines?"
        for name in [
            "Global Korea Scholarship (GKS)",
            "Chevening Scholarships",
            "Knight-Hennessy Scholars",
            "Eiffel Excellence Scholarship Program",
        ]:
            self.assertEqual(score(name, message), 0.0, msg=f"{name} should not match")

    def test_full_name_beats_partial(self):
        message = "Tell me about Chevening Scholarships deadlines"
        full = score("Chevening Scholarships", message)
        other = score("Commonwealth Master's Scholarships", message)
        self.assertGreater(full, other)
        self.assertGreater(full, 0.45)

    def test_single_generic_country_token_is_not_enough(self):
        message = "What about Korea?"
        self.assertEqual(score("Global Korea Scholarship (GKS)", message), 0.0)

    def test_name_tokens_strip_generic_words_and_keep_acronyms(self):
        tokens = _name_tokens("Erasmus Mundus Joint Master Degrees (EMJMD)")
        self.assertIn("erasmus", tokens)
        self.assertIn("emjmd", tokens)
        self.assertNotIn("master", tokens)
        self.assertNotIn("degrees", tokens)

    def test_turkish_characters_are_folded(self):
        message = "Turkiye Burslari deadline?"
        self.assertGreater(
            score("Türkiye Bursları (Turkey Scholarships)", message),
            0.45,
        )


if __name__ == "__main__":
    unittest.main()
