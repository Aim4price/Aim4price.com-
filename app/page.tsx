.page {
  min-height: 100vh;
  color: #17362c;
  background:
    radial-gradient(
      circle at 12% 0%,
      rgba(24, 77, 61, 0.08),
      transparent 30rem
    ),
    linear-gradient(180deg, #f7f9f8 0%, #eef3f5 100%);
}

.shell {
  width: min(calc(100% - 2rem), 1500px);
  margin: 0 auto;
  padding: 1.35rem 0 3.5rem;
  display: grid;
  gap: 1rem;
}

.hero,
.summaryCard,
.tableCard,
.notice {
  border: 1px solid rgba(18, 45, 37, 0.08);
  box-shadow:
    0 22px 50px rgba(18, 45, 37, 0.07),
    inset 0 1px 0 rgba(255, 255, 255, 0.82);
}

.hero {
  overflow: hidden;
  padding: clamp(1.25rem, 2vw, 1.7rem);
  border-radius: 1.4rem;
  color: #ffffff;
  background:
    radial-gradient(
      circle at 10% 0%,
      rgba(49, 197, 142, 0.28) 0,
      transparent 23rem
    ),
    linear-gradient(135deg, #102a23 0%, #15392f 52%, #17385d 100%);
}

.eyebrow {
  margin: 0 0 0.45rem;
  color: rgba(255, 255, 255, 0.74);
  font-size: 0.78rem;
  font-weight: 900;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.hero h1 {
  margin: 0;
  font-size: clamp(2rem, 4vw, 3.4rem);
  line-height: 0.98;
  letter-spacing: -0.055em;
}

.hero p:last-child {
  max-width: 54rem;
  margin: 0.85rem 0 0;
  color: rgba(255, 255, 255, 0.78);
  line-height: 1.6;
}

.summaryGrid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.85rem;
}

.summaryCard {
  display: grid;
  gap: 0.35rem;
  padding: 1rem;
  border-radius: 1.1rem;
  background: rgba(255, 255, 255, 0.94);
}

.summaryCard span {
  color: #60716a;
  font-size: 0.73rem;
  font-weight: 900;
  letter-spacing: 0.045em;
  text-transform: uppercase;
}

.summaryCard strong {
  font-size: 1.75rem;
  line-height: 1;
}

.notice {
  padding: 0.85rem 1rem;
  border-radius: 1rem;
  font-weight: 800;
  background: #ffffff;
}

.noticeSuccess {
  color: #176047;
  background: rgba(44, 173, 126, 0.12);
}

.noticeError {
  color: #8f3333;
  background: rgba(198, 75, 75, 0.12);
}

.tableCard {
  overflow: hidden;
  border-radius: 1.4rem;
  background: rgba(255, 255, 255, 0.96);
}

.tableHeader {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  padding: 1.2rem 1.25rem;
  border-bottom: 1px solid #e5ece8;
}

.tableHeader h2 {
  margin: 0;
  color: #12362d;
  font-size: 1.35rem;
  letter-spacing: -0.035em;
}

.tableHeader p {
  margin: 0.25rem 0 0;
  color: #65756f;
  line-height: 1.55;
}

.tableWrap {
  overflow-x: auto;
}

.userTable {
  width: 100%;
  min-width: 1180px;
  border-collapse: collapse;
}

.userTable th,
.userTable td {
  padding: 0.9rem 0.85rem;
  border-bottom: 1px solid #e8eeea;
  text-align: left;
  vertical-align: top;
  font-size: 0.88rem;
}

.userTable th {
  color: #52645d;
  background: #f5f8f6;
  font-size: 0.7rem;
  font-weight: 900;
  letter-spacing: 0.045em;
  text-transform: uppercase;
}

.nameCell {
  display: inline-block;
  color: #12362d;
  font-weight: 850;
}

.statusPill,
.passwordSet,
.passwordMissing {
  display: inline-flex;
  align-items: center;
  min-height: 1.85rem;
  padding: 0 0.62rem;
  border-radius: 999px;
  font-size: 0.74rem;
  font-weight: 900;
  white-space: nowrap;
}

.statusActive,
.passwordSet {
  color: #176047;
  background: rgba(44, 173, 126, 0.13);
}

.statusPending {
  color: #8a6125;
  background: rgba(230, 166, 63, 0.16);
}

.statusSuspended,
.passwordMissing {
  color: #8f3333;
  background: rgba(198, 75, 75, 0.12);
}

.actionGroup {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  min-width: 23rem;
}

.actionGroup button {
  min-height: 2.25rem;
  padding: 0 0.72rem;
  border-radius: 999px;
  border: 1px solid #dbe5df;
  background: #ffffff;
  color: #17362c;
  font: inherit;
  font-size: 0.78rem;
  font-weight: 850;
  cursor: pointer;
  transition:
    background 160ms ease,
    border-color 160ms ease,
    opacity 160ms ease;
}

.actionGroup button:hover:not(:disabled) {
  background: #f5f8f6;
  border-color: #cddbd3;
}

.actionGroup button:disabled {
  opacity: 0.54;
  cursor: not-allowed;
}

.emptyCell {
  color: #65756f;
  text-align: center !important;
}

@media (max-width: 900px) {
  .summaryGrid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .shell {
    width: min(calc(100% - 1rem), 1500px);
    padding-top: 0.8rem;
  }

  .summaryGrid {
    grid-template-columns: 1fr;
  }

  .userTable,
  .userTable tbody,
  .userTable tr,
  .userTable td {
    display: block;
    width: 100%;
    min-width: 0;
  }

  .userTable thead {
    display: none;
  }

  .userTable tr {
    padding: 0.8rem;
    border-bottom: 1px solid #e8eeea;
  }

  .userTable td {
    display: grid;
    grid-template-columns: 8.5rem minmax(0, 1fr);
    gap: 0.75rem;
    padding: 0.45rem 0;
    border: 0;
  }

  .userTable td::before {
    content: attr(data-label);
    color: #60716a;
    font-size: 0.7rem;
    font-weight: 900;
    letter-spacing: 0.045em;
    text-transform: uppercase;
  }

  .actionGroup {
    min-width: 0;
  }
}
