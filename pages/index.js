// Redirect root to the static index.html in /public
export default function Home() { return null; }

export async function getServerSideProps({ res }) {
  res.writeHead(302, { Location: '/index.html' });
  res.end();
  return { props: {} };
}
