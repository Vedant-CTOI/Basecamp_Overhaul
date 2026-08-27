import ExpeditionMark from "@/components/ExpeditionMark";
import styles from "./page.module.css";

export default function MountainMarkStudy() {
  return (
    <main className={styles.page}>
      <div className={styles.grid} aria-hidden="true" />

      <header className={styles.header}>
        <div className={styles.headerLabel}>
          <span className={styles.liveDot} aria-hidden="true" />
          Basecamp identity study
        </div>
        <span>Frontier marks / Live forms</span>
      </header>

      <section className={styles.stage} aria-labelledby="study-title">
        <div className={styles.intro}>
          <p>Two starting points</p>
          <h1 id="study-title">Where the adventure begins.</h1>
        </div>

        <div className={styles.studies}>
          <article className={styles.study}>
            <div className={styles.object}>
              <ExpeditionMark concept="tent" />
            </div>
            <div className={styles.caption}>
              <span className={styles.number}>01</span>
              <div>
                <h2>Expedition tent</h2>
                <p>Familiar, grounded, ready.</p>
              </div>
            </div>
          </article>

          <div className={styles.divider} aria-hidden="true" />

          <article className={`${styles.study} ${styles.studySecond}`}>
            <div className={styles.object}>
              <ExpeditionMark concept="pod" />
            </div>
            <div className={styles.caption}>
              <span className={styles.number}>02</span>
              <div>
                <h2>Tent landing pod</h2>
                <p>A base built to depart.</p>
              </div>
            </div>
          </article>
        </div>

        <div className={styles.lockup} aria-label="Basecamp">
          <span>Basecamp</span>
          <div className={styles.lockupRule} />
          <span>Frontier mark study</span>
        </div>

        <p className={styles.instruction}>
          Drag either object to inspect the form.
        </p>
      </section>

      <footer className={styles.footer}>
        <span>Concept comparison · 01 / 02</span>
        <span>Ogilvy red · square plinths</span>
      </footer>
    </main>
  );
}
