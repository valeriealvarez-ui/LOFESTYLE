public class Prenda {
    private String nombre;
    private String tipo;
    private String color;
    private String talla;

    public Prenda(String nombre, String tipo, String color, String talla) {
        this.nombre = nombre;
        this.tipo = tipo;
        this.color = color;
        this.talla = talla;
    }

    public String getNombre() {
        return nombre;
    }

    public String getTipo() {
        return tipo;
    }

    public String getColor() {
        return color;
    }

    public String getTalla() {
        return talla;
    }
}
