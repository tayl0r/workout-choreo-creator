function StubComponent({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center">
      <h2 className="text-2xl font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
        {title}
      </h2>
      <p style={{ color: 'var(--text-secondary)' }}>Coming soon — {description}</p>
    </div>
  );
}

export default StubComponent;
