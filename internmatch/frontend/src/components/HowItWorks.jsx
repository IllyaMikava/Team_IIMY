const STEPS = [
  {
    n: 1,
    title: 'Upload your CV',
    body: 'We extract the text from your PDF or DOCX — projects, skills, experience and all.',
  },
  {
    n: 2,
    title: 'Semantic match',
    body: 'Vector search compares the meaning of your CV against every stored job description.',
  },
  {
    n: 3,
    title: 'Get contacted',
    body: "Every strong match emails you the role and the recruiter's predefined next step.",
  },
]

export default function HowItWorks() {
  return (
    <section id="how" className="how-section">
      <div className="container">
        <h2 className="section-title">How it works</h2>
        <div className="steps">
          {STEPS.map((s) => (
            <div className="step" key={s.n}>
              <div className="step-num">{s.n}</div>
              <h3>{s.title}</h3>
              <p>{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
