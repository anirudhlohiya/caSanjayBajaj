import { DEFAULT_FAQS, FAQ_CATEGORIES } from './default-faqs';

describe('default FAQs', () => {
  it('fit the database columns and use known categories', () => {
    for (const f of DEFAULT_FAQS) {
      expect(FAQ_CATEGORIES).toContain(f.category);
      expect(f.question.length).toBeLessThanOrEqual(300);
      expect(f.answer_md.length).toBeLessThanOrEqual(5000);
    }
  });

  it('have no duplicate questions', () => {
    const questions = DEFAULT_FAQS.map((f) => f.question.toLowerCase());
    expect(new Set(questions).size).toBe(questions.length);
  });
});
