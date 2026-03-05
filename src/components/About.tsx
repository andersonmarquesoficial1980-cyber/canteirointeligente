import { motion } from "framer-motion";

const stats = [
  { value: "150+", label: "Projects Delivered" },
  { value: "98%", label: "Client Satisfaction" },
  { value: "8+", label: "Years Experience" },
  { value: "40+", label: "Team Members" },
];

const About = () => {
  return (
    <section id="about" className="py-32 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-20 items-center">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6 }}
          >
            <p className="text-primary font-display text-sm tracking-[0.3em] uppercase mb-4">About Us</p>
            <h2 className="text-4xl md:text-5xl font-display font-bold tracking-tight mb-8">
              We turn ideas into <span className="text-gradient">digital reality</span>
            </h2>
            <div className="space-y-4 text-muted-foreground leading-relaxed">
              <p>
                RDO Digital is a full-service digital agency that partners with ambitious brands 
                to create exceptional digital products and experiences.
              </p>
              <p>
                Our team of designers, developers, and strategists work together to deliver 
                solutions that are not just beautiful, but drive measurable business results.
              </p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="grid grid-cols-2 gap-6"
          >
            {stats.map((stat, i) => (
              <div
                key={stat.label}
                className="bg-card border border-border rounded-xl p-6 text-center"
              >
                <div className="text-3xl md:text-4xl font-display font-bold text-gradient mb-2">
                  {stat.value}
                </div>
                <div className="text-sm text-muted-foreground font-display tracking-wide">
                  {stat.label}
                </div>
              </div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default About;
